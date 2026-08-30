<?php

require_once __DIR__ . '/sso-secret.php';

const CV_SSO_COOKIE = 'cv_sso';
const CV_SSO_LIFETIME = 28800;

function ssoBase64Encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function ssoBase64Decode(string $value): string|false
{
    $padding = strlen($value) % 4;
    if ($padding) {
        $value .= str_repeat('=', 4 - $padding);
    }
    return base64_decode(strtr($value, '-_', '+/'), true);
}

function ssoCreateToken(array $identity): string
{
    $now = time();
    $payload = array(
        'v' => 1,
        'iat' => $now,
        'exp' => $now + CV_SSO_LIFETIME,
        'role' => $identity['role'],
        'tid' => (int)$identity['tid'],
        'sid' => isset($identity['sid']) ? (int)$identity['sid'] : 0,
        'lid' => isset($identity['lid']) ? (int)$identity['lid'] : 0,
        'label' => (string)$identity['label'],
    );
    $encoded = ssoBase64Encode(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    return $encoded . '.' . hash_hmac('sha256', $encoded, CV_SSO_SECRET);
}

function ssoReadToken(?string $token = null): ?array
{
    $token = $token ?? ($_COOKIE[CV_SSO_COOKIE] ?? '');
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2 || !hash_equals(hash_hmac('sha256', $parts[0], CV_SSO_SECRET), $parts[1])) {
        return null;
    }
    $json = ssoBase64Decode($parts[0]);
    $payload = is_string($json) ? json_decode($json, true) : null;
    if (!is_array($payload) || ($payload['v'] ?? 0) !== 1 || ($payload['exp'] ?? 0) < time()) {
        return null;
    }
    if (!in_array($payload['role'] ?? '', array('student', 'teacher'), true)) {
        return null;
    }
    if ((int)($payload['tid'] ?? 0) <= 0) {
        return null;
    }
    if ($payload['role'] === 'student' && (int)($payload['sid'] ?? 0) <= 0) {
        return null;
    }
    return $payload;
}

function ssoSetCookie(string $token): void
{
    setcookie(CV_SSO_COOKIE, $token, array(
        'expires' => time() + CV_SSO_LIFETIME,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ));
}

function ssoClearCookie(): void
{
    setcookie(CV_SSO_COOKIE, '', array(
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ));
}

function ssoRequireIdentity(): array
{
    $identity = ssoReadToken();
    if (!$identity) {
        header('Location: /portail/?session=expiree');
        exit;
    }
    return $identity;
}
