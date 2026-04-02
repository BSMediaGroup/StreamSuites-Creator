param(
  [int]$Port = 8793
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runToken = Get-Date -Format "yyyyMMddHHmmssfff"
$stdoutLog = Join-Path $repoRoot "tmp-wrangler-validate-$runToken.out.log"
$stderrLog = Join-Path $repoRoot "tmp-wrangler-validate-$runToken.err.log"
$playwrightSession = "creator-pages-routing-validate"

$compatibilityDate = (Get-Date).AddDays(-365).ToString("yyyy-MM-dd")
$process = $null
$invokeWebRequestOptions = @{
  MaximumRedirection = 0
  ErrorAction = "Stop"
}

if ($PSVersionTable.PSVersion.Major -lt 6) {
  $invokeWebRequestOptions.UseBasicParsing = $true
}

function Invoke-RouteCheck {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [int]$ExpectedStatus,
    [switch]$RejectHtml
  )

  $response = $null
  $statusCode = $null

  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port$Path" @invokeWebRequestOptions
    $statusCode = $response.StatusCode
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if (-not $statusCode) {
      throw
    }
  }

  if ($statusCode -ne $ExpectedStatus) {
    throw "Route $Path returned $statusCode, expected $ExpectedStatus."
  }

  if ($RejectHtml -and $response -and $response.Content -match "<!DOCTYPE html>") {
    throw "Route $Path unexpectedly returned HTML."
  }
}

function Invoke-BrowserRouteValidation {
  $code = @"
async (page) => {
  const baseUrl = 'http://127.0.0.1:$Port';
  const sessionPayload = {
    authenticated: true,
    role: 'creator',
    name: 'Route Audit',
    email: 'route-audit@example.com',
    user_code: 'CRT-001',
    creator_workspace_access: {
      allowed: true,
      allowed_routes: [
        '/overview',
        '/account',
        '/integrations',
        '/integrations/discord',
        '/platforms/youtube',
        '/integrations/youtube'
      ]
    }
  };

  const accountPayload = {
    user_code: 'CRT-001',
    display_name: 'Route Audit',
    email: 'route-audit@example.com',
    profile: {
      slug: 'route-audit',
      bio: '',
      avatar_url: '',
      cover_url: '',
      background_url: '',
      streamsuites_profile_enabled: true,
      streamsuites_directory_enabled: true,
      findme_profile_enabled: false,
      findme_directory_enabled: false
    },
    integrations: []
  };

  const statusSummaryPayload = {
    page: { name: 'StreamSuites' },
    status: { indicator: 'none', description: 'All Systems Operational' }
  };

  const versionPayload = { version: '0.4.2-alpha', build: 'route-validation' };
  const emptyObject = {};

  await page.context().route('**/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload)
    });
  });
  await page.context().route('**/auth/access-state', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ mode: 'normal', bypass_enabled: false })
    });
  });
  await page.context().route('https://api.streamsuites.app/account/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(accountPayload)
    });
  });
  await page.context().route('https://api.streamsuites.app/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyObject)
    });
  });
  await page.context().route('https://admin.streamsuites.app/runtime/exports/version.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(versionPayload)
    });
  });
  await page.context().route('https://v0hwlmly3pd2.statuspage.io/api/v2/summary.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(statusSummaryPayload)
    });
  });

  const cases = [
    {
      pathname: '/account',
      expectedPathname: '/account',
      expectedRoute: 'account',
      expectedHeading: 'Account settings'
    },
    {
      pathname: '/overview',
      expectedPathname: '/overview',
      expectedRoute: 'overview',
      expectedHeading: 'Creator control center'
    },
    {
      pathname: '/integrations/discord',
      expectedPathname: '/integrations/discord',
      expectedRoute: 'integrations/discord',
      expectedHeading: 'Discord integration'
    },
    {
      pathname: '/platforms/youtube',
      expectedPathname: '/platforms/youtube',
      expectedRoute: 'integrations/youtube',
      expectedHeading: 'YouTube integration'
    }
  ];

  for (const testCase of cases) {
    await page.goto(`${baseUrl}${testCase.pathname}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const actual = await page.evaluate(() => {
      const headingNode =
        document.querySelector('#view-container .section-header h2') ||
        document.querySelector('#view-container .ss-header .ss-subtitle') ||
        document.querySelector('#view-container h2');

      return {
        pathname: window.location.pathname,
        currentView: window.App?.currentView || '',
        resolvedRoute: window.App?.renderRouter?.resolveCurrentRoute?.() || '',
        heading: headingNode?.textContent?.trim() || '',
        title: document.title
      };
    });

    if (actual.pathname !== testCase.expectedPathname) {
      throw new Error(
        `Requested ${testCase.pathname} ended on ${actual.pathname}, expected ${testCase.expectedPathname}.`
      );
    }

    if (actual.currentView !== testCase.expectedRoute) {
      throw new Error(
        `Requested ${testCase.pathname} resolved view ${actual.currentView}, expected ${testCase.expectedRoute}.`
      );
    }

    if (!actual.heading.includes(testCase.expectedHeading)) {
      throw new Error(
        `Requested ${testCase.pathname} rendered heading "${actual.heading}", expected to include "${testCase.expectedHeading}".`
      );
    }
  }

  const invalidResponse = await page.goto(`${baseUrl}/definitely-invalid-route`, {
    waitUntil: 'domcontentloaded'
  });
  await page.waitForTimeout(250);

  const invalidState = await page.evaluate(() => ({
    pathname: window.location.pathname,
    title: document.title,
    heading:
      document.querySelector('main h1')?.textContent?.trim() ||
      document.querySelector('#view-container h2')?.textContent?.trim() ||
      ''
  }));

  if (invalidResponse?.status() !== 404) {
    throw new Error(`Invalid route returned ${invalidResponse?.status()}, expected 404.`);
  }

  if (invalidState.pathname !== '/definitely-invalid-route') {
    throw new Error(
      `Invalid route rewrote to ${invalidState.pathname} instead of preserving /definitely-invalid-route.`
    );
  }

  if (
    invalidState.pathname === '/overview' ||
    /creator control center/i.test(invalidState.heading) ||
    /creator dashboard/i.test(invalidState.title)
  ) {
    throw new Error('Invalid route silently rendered the overview surface.');
  }

  return 'Creator browser route validation passed.';
}
"@

  & npx.cmd --yes --package @playwright/cli playwright-cli --session $playwrightSession open about:blank | Out-Null
  & npx.cmd --yes --package @playwright/cli playwright-cli --session $playwrightSession run-code $code
  if ($LASTEXITCODE -ne 0) {
    throw "Creator browser route validation failed."
  }
}

try {
  $process = Start-Process -FilePath "npx.cmd" -ArgumentList @(
    "wrangler",
    "pages",
    "dev",
    ".",
    "--port",
    $Port,
    "--compatibility-date",
    $compatibilityDate
  ) -WorkingDirectory $repoRoot -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) {
      throw "wrangler pages dev exited before validation completed."
    }

    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -TimeoutSec 2 @invokeWebRequestOptions | Out-Null
      $ready = $true
      break
    } catch {
      continue
    }
  }

  if (-not $ready) {
    throw "Timed out waiting for wrangler pages dev on port $Port."
  }

  Invoke-RouteCheck -Path "/overview" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/account" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/integrations/discord" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/platforms/youtube" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/definitely-invalid-route" -ExpectedStatus 404
  Invoke-RouteCheck -Path "/js/app.js" -ExpectedStatus 200 -RejectHtml

  $routeAudit = @'
const fs = require('fs');
const vm = require('vm');

const sandbox = {
  console,
  URL,
  window: {
    location: new URL('http://127.0.0.1:__PORT__/overview')
  }
};
sandbox.window.window = sandbox.window;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/routes.js', 'utf8'), sandbox);

const routes = sandbox.window.StreamSuitesCreatorRoutes;
const cases = [
  ['/overview', 'overview'],
  ['/account', 'account'],
  ['/integrations/discord', 'integrations/discord'],
  ['/platforms/youtube', 'integrations/youtube'],
  ['/definitely-invalid-route', '']
];

for (const [pathname, expected] of cases) {
  const actual = routes.resolveRouteFromUrlLike(new URL(`http://127.0.0.1:__PORT__${pathname}`));
  if (actual !== expected) {
    throw new Error(`Creator route resolver mismatch for ${pathname}: expected "${expected}", got "${actual}"`);
  }
}
'@
  $routeAudit = $routeAudit.Replace("__PORT__", [string]$Port)

  $routeAudit | node -
  if ($LASTEXITCODE -ne 0) {
    throw "Creator route resolver validation failed."
  }

  Invoke-BrowserRouteValidation
  Write-Host "Creator Pages routing validation passed on port $Port."
} finally {
  & npx.cmd --yes --package @playwright/cli playwright-cli --session $playwrightSession close | Out-Null
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
      if ($_ -and $_ -ne 0) {
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
      }
    }
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $stdoutLog) {
    Remove-Item -LiteralPath $stdoutLog -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $stderrLog) {
    Remove-Item -LiteralPath $stderrLog -Force -ErrorAction SilentlyContinue
  }
}
