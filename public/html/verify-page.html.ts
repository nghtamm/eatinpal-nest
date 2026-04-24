const PLAY_STORE_URL = 'https://play.google.com/store';
const APP_STORE_URL = 'https://apps.apple.com';

export function renderVerifyPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EatinPal</title>
</head>
<body>
<script>
(function () {
  var msg = ${JSON.stringify(message)};
  var playStore = ${JSON.stringify(PLAY_STORE_URL)};
  var appStore = ${JSON.stringify(APP_STORE_URL)};
  var ua = navigator.userAgent || '';
  if (/Android/i.test(ua))          { window.location.replace(playStore); return; }
  if (/iPhone|iPad|iPod/i.test(ua)) { window.location.replace(appStore); return; }
  alert(msg);
  window.close();
})();
</script>
</body>
</html>`;
}
