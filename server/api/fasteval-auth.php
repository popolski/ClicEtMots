<?php

require_once __DIR__ . '/auth-commune-secret.php';

function fastEvalRequest(string $url, string $json): ?array
{
    $response = false;
    $status = 0;

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, array(
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => array('Content-Type: application/json', 'Connection: close'),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_FOLLOWLOCATION => false,
        ));
        $response = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        if ($response === false) {
            error_log('Authentification commune Fast Eval : erreur cURL ' . curl_errno($curl));
        }
        curl_close($curl);
    }

    if (!is_string($response) || $status !== 200) {
        $context = stream_context_create(array('http' => array(
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\nConnection: close\r\n",
            'content' => $json,
            'timeout' => 6,
            'ignore_errors' => true,
        )));
        $response = @file_get_contents($url, false, $context);
        $status = 0;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $match)) {
            $status = (int)$match[1];
        }
    }

    if (!is_string($response) || $status !== 200) {
        error_log('Authentification commune Fast Eval indisponible, statut HTTP ' . $status);
        return null;
    }

    $data = json_decode($response, true);
    return is_array($data) ? $data : null;
}

function authenticateWithFastEval(string $role, string $identifiant, string $code, int $expectedPersonId, int $teacherId): bool
{
    if (!in_array($role, array('student', 'teacher'), true) || $expectedPersonId <= 0 || $teacherId <= 0 || $identifiant === '' || $code === '') {
        return false;
    }

    $timestamp = time();
    $nonce = bin2hex(random_bytes(16));
    $canonical = $timestamp . "\n" . $nonce . "\n" . $role . "\n" . $teacherId . "\n" . $identifiant . "\n" . $code;
    $request = array(
        'role' => $role,
        'prenom' => $identifiant,
        'code' => $code,
        'idEnseignant' => $teacherId,
        'timestamp' => $timestamp,
        'nonce' => $nonce,
        'signature' => hash_hmac('sha256', $canonical, COMMON_AUTH_SECRET),
    );

    $json = json_encode($request, JSON_UNESCAPED_UNICODE);
    if (!is_string($json)) {
        return false;
    }
    $response = fastEvalRequest(COMMON_AUTH_FASTEVAL_URL, $json);
    if (!$response || empty($response['ok']) || ($response['role'] ?? '') !== $role || (int)($response['idPersonne'] ?? 0) !== $expectedPersonId) {
        return false;
    }
    if (!hash_equals($nonce, (string)($response['nonce'] ?? '')) || abs(time() - (int)($response['timestamp'] ?? 0)) > 60) {
        return false;
    }

    $responseCanonical = '1' . "\n" . $role . "\n" . $expectedPersonId . "\n" . (string)($response['prenom'] ?? '')
        . "\n" . (int)$response['timestamp'] . "\n" . $nonce;
    return hash_equals(
        hash_hmac('sha256', $responseCanonical, COMMON_AUTH_SECRET),
        (string)($response['signature'] ?? '')
    );
}
