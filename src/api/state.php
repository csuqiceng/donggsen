<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
$allowedOrigin = getenv('FITNESS_ISLAND_ALLOWED_ORIGIN') ?: '';
if ($origin && ($allowedOrigin === '*' || $origin === $allowedOrigin || parse_url($origin, PHP_URL_HOST) === $host)) {
    header('Access-Control-Allow-Origin: ' . ($allowedOrigin === '*' ? '*' : $origin));
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$maxBodyBytes = 262144;
$maxUsers = 8;
$staleAfterMs = 14 * 24 * 60 * 60 * 1000;
$room = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['room'] ?? 'fitness-island-v1');
$dataDir = dirname(__DIR__) . '/data';
$dataFile = $dataDir . '/' . $room . '.json';

if (!is_dir($dataDir) && !mkdir($dataDir, 0755, true)) {
    respond_error(500, 'Cannot create data directory');
}

function respond_error(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function default_state(string $room): array {
    return [
        'ok' => true,
        'version' => 1,
        'room' => $room,
        'updatedAt' => 0,
        'users' => new stdClass()
    ];
}

function read_state($handle, string $room): array {
    rewind($handle);
    $raw = stream_get_contents($handle);
    if (!$raw) return default_state($room);
    $state = json_decode($raw, true);
    if (!is_array($state)) return default_state($room);
    if (!isset($state['users']) || !is_array($state['users'])) $state['users'] = [];
    $state['ok'] = true;
    $state['room'] = $room;
    return $state;
}

function write_state($handle, array $state): void {
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($state, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fflush($handle);
}

function cleanup_users(array &$state, int $maxUsers, int $staleAfterMs): void {
    if (!isset($state['users']) || !is_array($state['users'])) {
        $state['users'] = [];
        return;
    }
    $nowMs = time() * 1000;
    foreach ($state['users'] as $id => $user) {
        $lastActive = (int)($user['lastActive'] ?? $user['updated'] ?? 0);
        if ($lastActive > 0 && ($nowMs - $lastActive) > $staleAfterMs) unset($state['users'][$id]);
    }
    if (count($state['users']) > $maxUsers) {
        uasort($state['users'], function ($a, $b) {
            return (int)($b['lastActive'] ?? $b['updated'] ?? 0) <=> (int)($a['lastActive'] ?? $a['updated'] ?? 0);
        });
        $state['users'] = array_slice($state['users'], 0, $maxUsers, true);
    }
}

function normalize_username(string $name): string {
    $name = trim(preg_replace('/\s+/u', ' ', $name));
    return $name === '' ? '' : strtolower($name);
}

function user_key_from_name(string $name): string {
    return 'name_' . substr(hash('sha256', normalize_username($name)), 0, 24);
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') respond_error(405, 'Method not allowed');
$handle = fopen($dataFile, 'c+');
if (!$handle) respond_error(500, 'Cannot open data file');

if (!flock($handle, LOCK_EX)) {
    fclose($handle);
    respond_error(500, 'Cannot lock data file');
}

$state = read_state($handle, $room);
cleanup_users($state, $maxUsers, $staleAfterMs);

if ($method === 'POST') {
    $rawInput = file_get_contents('php://input') ?: '';
    if (strlen($rawInput) > $maxBodyBytes) {
        flock($handle, LOCK_UN);
        fclose($handle);
        respond_error(413, 'Payload too large');
    }
    $input = json_decode($rawInput, true);
    if (!is_array($input) || !isset($input['user']) || !is_array($input['user'])) {
        flock($handle, LOCK_UN);
        fclose($handle);
        respond_error(400, 'Invalid payload');
    }

    $user = $input['user'];
    $clientId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($user['clientId'] ?? ''));
    if ($clientId === '') {
        flock($handle, LOCK_UN);
        fclose($handle);
        respond_error(400, 'Missing clientId');
    }
    $displayName = trim((string)($user['displayName'] ?? $user['username'] ?? ''));
    if ($displayName === '') {
        flock($handle, LOCK_UN);
        fclose($handle);
        respond_error(400, 'Missing username');
    }
    $userKey = user_key_from_name($displayName);

    $allowed = [
        'clientId', 'username', 'displayName', 'avatar', 'message', 'dayStates', 'currentDayIndex',
        'inventory', 'warehouseContribution', 'collection', 'selectedDifficulty',
        'lastActive', 'updated', 'syncVersion'
    ];
    $clean = [];
    foreach ($allowed as $key) {
        if (array_key_exists($key, $user)) $clean[$key] = $user[$key];
    }
    $clean['clientId'] = $clientId;
    $clean['userKey'] = $userKey;
    $clean['username'] = $displayName;
    $clean['displayName'] = $displayName;
    $clean['lastActive'] = time() * 1000;
    $clean['updated'] = time() * 1000;

    // ── 乐观并发：拒绝旧数据覆盖新数据 ──
    $incomingVersion = (int)($clean['syncVersion'] ?? 0);
    $existingUser = $state['users'][$userKey] ?? null;
    $storedVersion = (int)($existingUser['syncVersion'] ?? 0);
    if ($existingUser !== null && $incomingVersion < $storedVersion) {
        flock($handle, LOCK_UN);
        fclose($handle);
        http_response_code(409);
        echo json_encode([
            'ok' => false,
            'error' => 'Stale data rejected (version ' . $incomingVersion . ' < ' . $storedVersion . ')',
            'version' => $storedVersion,
            'users' => $state['users']
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $clean['syncVersion'] = $storedVersion + 1;

    if (!isset($state['users']) || !is_array($state['users'])) $state['users'] = [];
    $state['users'][$userKey] = $clean;
    $state['updatedAt'] = time() * 1000;
    write_state($handle, $state);
}

flock($handle, LOCK_UN);
fclose($handle);

echo json_encode($state, JSON_UNESCAPED_UNICODE);
