<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

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

$method = $_SERVER['REQUEST_METHOD'];
$handle = fopen($dataFile, 'c+');
if (!$handle) respond_error(500, 'Cannot open data file');

if (!flock($handle, LOCK_EX)) {
    fclose($handle);
    respond_error(500, 'Cannot lock data file');
}

$state = read_state($handle, $room);

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input') ?: '', true);
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

    $allowed = [
        'clientId', 'username', 'displayName', 'dayStates', 'currentDayIndex',
        'inventory', 'warehouseContribution', 'collection', 'selectedDifficulty',
        'lastActive', 'updated'
    ];
    $clean = [];
    foreach ($allowed as $key) {
        if (array_key_exists($key, $user)) $clean[$key] = $user[$key];
    }
    $clean['clientId'] = $clientId;
    $clean['lastActive'] = time() * 1000;
    $clean['updated'] = time() * 1000;

    if (!isset($state['users']) || !is_array($state['users'])) $state['users'] = [];
    $state['users'][$clientId] = $clean;
    $state['updatedAt'] = time() * 1000;
    write_state($handle, $state);
}

flock($handle, LOCK_UN);
fclose($handle);

echo json_encode($state, JSON_UNESCAPED_UNICODE);
