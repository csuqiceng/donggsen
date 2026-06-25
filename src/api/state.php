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
const FIXED_USERS = ['哥哥', '乖宝'];
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
        'users' => new stdClass(),
        'shared' => [
            'giftClaims' => new stdClass(),
            'wishLists' => new stdClass(),
            'wishFulfillments' => new stdClass(),
            'mailbox' => [],
            'events' => [],
            'decor' => new stdClass(),
            'placedCrafts' => [],
            'buildingPositions' => new stdClass()
        ]
    ];
}

function ensure_shared_state(array &$state): void {
    if (!isset($state['shared']) || !is_array($state['shared'])) $state['shared'] = [];
    if (!isset($state['shared']['giftClaims']) || !is_array($state['shared']['giftClaims'])) $state['shared']['giftClaims'] = [];
    if (!isset($state['shared']['wishLists']) || !is_array($state['shared']['wishLists'])) $state['shared']['wishLists'] = [];
    if (!isset($state['shared']['wishFulfillments']) || !is_array($state['shared']['wishFulfillments'])) $state['shared']['wishFulfillments'] = [];
    if (!isset($state['shared']['mailbox']) || !is_array($state['shared']['mailbox'])) $state['shared']['mailbox'] = [];
    if (!isset($state['shared']['events']) || !is_array($state['shared']['events'])) $state['shared']['events'] = [];
    if (!isset($state['shared']['decor']) || !is_array($state['shared']['decor'])) $state['shared']['decor'] = [];
    if (!isset($state['shared']['placedCrafts']) || !is_array($state['shared']['placedCrafts'])) $state['shared']['placedCrafts'] = [];
    if (!isset($state['shared']['buildingPositions']) || !is_array($state['shared']['buildingPositions'])) $state['shared']['buildingPositions'] = [];
}

function read_state($handle, string $room): array {
    rewind($handle);
    $raw = stream_get_contents($handle);
    if (!$raw) return default_state($room);
    $state = json_decode($raw, true);
    if (!is_array($state)) return default_state($room);
    if (!isset($state['users']) || !is_array($state['users'])) $state['users'] = [];
    ensure_shared_state($state);
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
        if (!is_allowed_username((string)($user['displayName'] ?? $user['username'] ?? ''))) {
            unset($state['users'][$id]);
            continue;
        }
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

function is_allowed_username(string $name): bool {
    return in_array(normalize_username($name), array_map('normalize_username', FIXED_USERS), true);
}

function user_key_from_name(string $name): string {
    return 'name_' . substr(hash('sha256', normalize_username($name)), 0, 24);
}

function clean_text(string $value, int $maxLen): string {
    $value = trim(preg_replace('/\s+/u', ' ', $value));
    if (function_exists('mb_substr')) return mb_substr($value, 0, $maxLen, 'UTF-8');
    return substr($value, 0, $maxLen);
}

function clean_id(string $value): string {
    return substr(preg_replace('/[^a-zA-Z0-9_.%-]/', '', $value), 0, 96);
}

function merge_shared_state(array &$state, array $sharedPatch, string $userKey, string $displayName): void {
    ensure_shared_state($state);
    $now = time() * 1000;

    if (array_key_exists('wishList', $sharedPatch) && is_array($sharedPatch['wishList'])) {
        $items = [];
        foreach ($sharedPatch['wishList'] as $item) {
            $clean = clean_text((string)$item, 40);
            if ($clean !== '' && !in_array($clean, $items, true)) $items[] = $clean;
            if (count($items) >= 5) break;
        }
        $state['shared']['wishLists'][$userKey] = [
            'ownerKey' => $userKey,
            'ownerName' => $displayName,
            'items' => $items,
            'updatedAt' => $now
        ];
    }

    if (array_key_exists('giftClaim', $sharedPatch) && is_array($sharedPatch['giftClaim'])) {
        $claim = $sharedPatch['giftClaim'];
        $id = clean_id((string)($claim['id'] ?? ''));
        $ruleId = clean_id((string)($claim['ruleId'] ?? ''));
        $status = (string)($claim['status'] ?? 'requested');
        if ($id !== '' && $ruleId !== '' && in_array($status, ['requested', 'redeemed'], true)) {
            $existing = $state['shared']['giftClaims'][$id] ?? [];
            if (!is_array($existing)) $existing = [];
            $ownerKey = clean_id((string)($claim['ownerKey'] ?? ($existing['ownerKey'] ?? $userKey)));
            $ownerName = clean_text((string)($claim['ownerName'] ?? ($existing['ownerName'] ?? $displayName)), 20);
            $requestedAt = (int)($claim['requestedAt'] ?? ($existing['requestedAt'] ?? $now));
            if (($existing['status'] ?? '') === 'redeemed' && $status !== 'redeemed') {
                // Cannot reopen redeemed gift.
                return;
            }
            if ($status === 'requested' && $ownerKey !== $userKey) {
                return;
            }
            if ($status === 'redeemed') {
                if (($existing['status'] ?? '') !== 'requested') return;
                if (($existing['ownerKey'] ?? $ownerKey) === $userKey) {
                    // Cannot redeem own gift.
                    return;
                }
                $ownerKey = clean_id((string)($existing['ownerKey'] ?? $ownerKey));
                $ownerName = clean_text((string)($existing['ownerName'] ?? $ownerName), 20);
                $requestedAt = (int)($existing['requestedAt'] ?? $requestedAt);
            }
            $next = [
                'id' => $id,
                'ruleId' => $ruleId,
                'ownerKey' => $ownerKey ?: $userKey,
                'ownerName' => $ownerName ?: $displayName,
                'status' => $status,
                'requestedAt' => $requestedAt,
                'redeemedAt' => 0,
                'redeemedBy' => '',
                'updatedAt' => $now
            ];
            if ($status === 'redeemed') {
                $next['redeemedAt'] = (int)($claim['redeemedAt'] ?? $now);
                $next['redeemedBy'] = clean_text((string)($claim['redeemedBy'] ?? $displayName), 20);
            }
            $state['shared']['giftClaims'][$id] = $next;
        }
    }

    if (array_key_exists('wishFulfillment', $sharedPatch) && is_array($sharedPatch['wishFulfillment'])) {
        $entry = $sharedPatch['wishFulfillment'];
        $id = clean_id((string)($entry['id'] ?? ''));
        $item = clean_text((string)($entry['item'] ?? ''), 40);
        $ownerKey = clean_id((string)($entry['ownerKey'] ?? ''));
        $ownerName = clean_text((string)($entry['ownerName'] ?? '伙伴'), 20);
        if ($id !== '' && $item !== '' && $ownerKey !== '' && $ownerKey !== $userKey) {
            if (isset($state['shared']['wishFulfillments'][$id])) return;
            $ownerList = $state['shared']['wishLists'][$ownerKey]['items'] ?? [];
            if (!is_array($ownerList) || !in_array($item, $ownerList, true)) return;
            $state['shared']['wishFulfillments'][$id] = [
                'id' => $id,
                'item' => $item,
                'ownerKey' => $ownerKey,
                'ownerName' => $ownerName,
                'fulfilledByKey' => $userKey,
                'fulfilledByName' => $displayName,
                'fulfilledAt' => (int)($entry['fulfilledAt'] ?? $now),
                'status' => 'fulfilled',
                'updatedAt' => $now
            ];
        }
    }

    if (array_key_exists('decorItem', $sharedPatch) && is_array($sharedPatch['decorItem'])) {
        $decor = $sharedPatch['decorItem'];
        $id = clean_id((string)($decor['id'] ?? ''));
        if ($id !== '') {
            $state['shared']['decor'][$id] = [
                'id' => $id,
                'ownerKey' => $userKey,
                'ownerName' => $displayName,
                'placedAt' => (int)($decor['placedAt'] ?? $now),
                'updatedAt' => $now
            ];
        }
    }

    if (array_key_exists('craftPlacement', $sharedPatch) && is_array($sharedPatch['craftPlacement'])) {
        $craft = $sharedPatch['craftPlacement'];
        $cid = clean_id((string)($craft['id'] ?? ''));
        if ($cid !== '') {
            $state['shared']['placedCrafts'][] = [
                'id' => $cid,
                'recipeId' => clean_id((string)($craft['recipeId'] ?? '')),
                'x' => (float)($craft['x'] ?? 0),
                'y' => (float)($craft['y'] ?? 0),
                'ownerKey' => $userKey,
                'ownerName' => $displayName,
                'placedAt' => (int)($craft['placedAt'] ?? $now)
            ];
        }
    }

    if (array_key_exists('craftPosition', $sharedPatch) && is_array($sharedPatch['craftPosition'])) {
        $cp = $sharedPatch['craftPosition'];
        $cpid = clean_id((string)($cp['id'] ?? ''));
        if ($cpid !== '') {
            foreach ($state['shared']['placedCrafts'] as $i => $existing) {
                if (($existing['id'] ?? '') === $cpid) {
                    $state['shared']['placedCrafts'][$i]['x'] = (float)($cp['x'] ?? 0);
                    $state['shared']['placedCrafts'][$i]['y'] = (float)($cp['y'] ?? 0);
                    $state['shared']['placedCrafts'][$i]['ownerKey'] = $userKey;
                    $state['shared']['placedCrafts'][$i]['ownerName'] = $displayName;
                    $state['shared']['placedCrafts'][$i]['updatedAt'] = $now;
                    break;
                }
            }
        }
    }

    if (array_key_exists('buildingPosition', $sharedPatch) && is_array($sharedPatch['buildingPosition'])) {
        $bp = $sharedPatch['buildingPosition'];
        $bid = clean_id((string)($bp['id'] ?? ''));
        if ($bid !== '') {
            $state['shared']['buildingPositions'][$bid] = [
                'x' => (float)($bp['x'] ?? 0),
                'y' => (float)($bp['y'] ?? 0),
                'ownerKey' => $userKey,
                'ownerName' => $displayName,
                'updatedAt' => $now
            ];
        }
    }

    if (array_key_exists('mailboxEntry', $sharedPatch) && is_array($sharedPatch['mailboxEntry'])) {
        $entry = $sharedPatch['mailboxEntry'];
        $text = clean_text((string)($entry['text'] ?? ''), 80);
        if ($text !== '') {
            $state['shared']['mailbox'][] = [
                'id' => clean_id((string)($entry['id'] ?? ('mail_' . $now))),
                'authorKey' => $userKey,
                'authorName' => $displayName,
                'text' => $text,
                'createdAt' => (int)($entry['createdAt'] ?? $now)
            ];
            $state['shared']['mailbox'] = array_slice($state['shared']['mailbox'], -20);
        }
    }

    if (array_key_exists('weeklyEvent', $sharedPatch) && is_array($sharedPatch['weeklyEvent'])) {
        $event = $sharedPatch['weeklyEvent'];
        $id = clean_id((string)($event['id'] ?? ''));
        if ($id !== '') {
            $state['shared']['events'][$id] = [
                'id' => $id,
                'type' => clean_id((string)($event['type'] ?? 'weekly')),
                'title' => clean_text((string)($event['title'] ?? '周结算'), 40),
                'summary' => clean_text((string)($event['summary'] ?? ''), 220),
                'createdBy' => $displayName,
                'createdAt' => (int)($event['createdAt'] ?? $now)
            ];
        }
    }
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
    if (!is_allowed_username($displayName)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        respond_error(403, 'User is not allowed');
    }
    $userKey = user_key_from_name($displayName);

    $allowed = [
        'clientId', 'username', 'displayName', 'avatar', 'message', 'dayStates', 'currentDayIndex',
        'inventory', 'warehouseContribution', 'collection', 'selectedDifficulty',
        'selectedPlanMode', 'giftClaims', 'lastActive', 'updated', 'syncVersion'
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
            'users' => $state['users'],
            'shared' => $state['shared']
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $clean['syncVersion'] = $storedVersion + 1;

    if (!isset($state['users']) || !is_array($state['users'])) $state['users'] = [];
    $state['users'][$userKey] = $clean;
    if (isset($input['shared']) && is_array($input['shared'])) {
        merge_shared_state($state, $input['shared'], $userKey, $displayName);
    }
    $state['updatedAt'] = time() * 1000;
    write_state($handle, $state);
}

flock($handle, LOCK_UN);
fclose($handle);

echo json_encode($state, JSON_UNESCAPED_UNICODE);
