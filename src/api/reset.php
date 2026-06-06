<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$token = $_GET['token'] ?? '';
$expected = getenv('FITNESS_ISLAND_RESET_TOKEN') ?: 'reset-fitness-island';

if (!hash_equals($expected, $token)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
}

$room = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['room'] ?? 'fitness-island-v1');
$dataFile = dirname(__DIR__) . '/data/' . $room . '.json';

if (is_file($dataFile) && !unlink($dataFile)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Cannot delete data file'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['ok' => true, 'room' => $room, 'reset' => true], JSON_UNESCAPED_UNICODE);
