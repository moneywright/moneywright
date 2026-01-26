# Moneywright Installer for Windows
# Usage: irm moneywright.com/install.ps1 | iex

$ErrorActionPreference = "Stop"

# Colors
function Write-Color {
    param(
        [string]$Text,
        [string]$Color = "White",
        [switch]$NoNewline
    )
    if ($NoNewline) {
        Write-Host $Text -ForegroundColor $Color -NoNewline
    } else {
        Write-Host $Text -ForegroundColor $Color
    }
}

Write-Host ""
Write-Color "Installing Moneywright..." "Green"
Write-Host ""

# Detect architecture
$arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }

if ($arch -eq "x86") {
    Write-Color "32-bit Windows is not supported. Please use a 64-bit system." "Red"
    exit 1
}

# Install directory (Windows standard: %LOCALAPPDATA%\Moneywright)
$installDir = "$env:LOCALAPPDATA\Moneywright"

Write-Host "  OS:           " -NoNewline
Write-Color "Windows" "Cyan"
Write-Host "  Architecture: " -NoNewline
Write-Color $arch "Cyan"
Write-Host "  Install to:   " -NoNewline
Write-Color $installDir "Cyan"
Write-Host ""

# GitHub repo
$repo = "moneywright/moneywright"

Write-Color "Fetching latest release..." "Yellow"

try {
    $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ "User-Agent" = "Moneywright-Installer" }
    $version = $releases.tag_name
} catch {
    Write-Color "Failed to fetch latest version: $_" "Red"
    exit 1
}

Write-Host "  Version: " -NoNewline
Write-Color $version "Cyan"
Write-Host ""

# Construct download URL
$filename = "moneywright-windows-$arch.zip"
$downloadUrl = "https://github.com/$repo/releases/download/$version/$filename"

Write-Color "Downloading $filename..." "Yellow"

# Create temp directory
$tempDir = Join-Path $env:TEMP "moneywright-install-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    # Download
    $zipPath = Join-Path $tempDir $filename
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
    } catch {
        Write-Color "Failed to download from $downloadUrl" "Red"
        Write-Color "Make sure the release exists and includes binaries for Windows." "Yellow"
        exit 1
    }

    # Extract
    Write-Color "Extracting..." "Yellow"

    # Remove existing installation if present
    if (Test-Path $installDir) {
        # Keep .env and data folder if they exist
        $envBackup = $null
        $dataBackup = $null

        if (Test-Path "$installDir\.env") {
            $envBackup = Get-Content "$installDir\.env" -Raw
        }
        if (Test-Path "$installDir\data") {
            $dataBackup = "$tempDir\data-backup"
            Copy-Item -Path "$installDir\data" -Destination $dataBackup -Recurse
        }

        Remove-Item -Path $installDir -Recurse -Force
    }

    # Create install directory
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null

    # Extract zip
    Expand-Archive -Path $zipPath -DestinationPath $installDir -Force

    # Check if files are in a subdirectory and move them up if needed
    $subDirs = Get-ChildItem -Path $installDir -Directory
    if ($subDirs.Count -eq 1 -and (Get-ChildItem -Path $installDir -File).Count -eq 0) {
        $subDir = $subDirs[0].FullName
        Get-ChildItem -Path $subDir | Move-Item -Destination $installDir
        Remove-Item -Path $subDir -Force
    }

    # Restore .env and data if backed up
    if ($envBackup) {
        Set-Content -Path "$installDir\.env" -Value $envBackup
    }
    if ($dataBackup) {
        Copy-Item -Path $dataBackup -Destination "$installDir\data" -Recurse
    }

    Write-Host ""
    Write-Color "Installation complete!" "Green"
    Write-Host ""

    # ========================================================================
    # Database Configuration (only on first install)
    # ========================================================================

    # Skip database configuration if .env was restored (this is an update)
    if (-not $envBackup) {
        Write-Host "Database Configuration" -ForegroundColor White
        Write-Host ""
        Write-Host "Moneywright can use either:"
        Write-Host "  1. " -NoNewline
        Write-Color "SQLite" "Cyan" -NoNewline
        Write-Host " (default) - No setup needed, data stored locally"
        Write-Host "  2. " -NoNewline
        Write-Color "PostgreSQL" "Cyan" -NoNewline
        Write-Host " (recommended for cloud deployments)"
        Write-Host ""
        Write-Color "Note:" "Yellow" -NoNewline
        Write-Host " PostgreSQL requires an external database you've already set up."
        Write-Host "      If you don't have one, press Enter to use SQLite."
        Write-Host ""
        $usePostgres = Read-Host "Would you like to use an external PostgreSQL database? (y/N)"

        if ($usePostgres -eq "y" -or $usePostgres -eq "Y") {
            Write-Host ""
            Write-Host "Enter your PostgreSQL connection URL:"
            Write-Host "  Example: " -NoNewline
            Write-Color "postgresql://user:password@host:5432/dbname" "Cyan"
            Write-Host ""
            $databaseUrl = Read-Host "DATABASE_URL"

            if ($databaseUrl) {
                $envFile = "$installDir\.env"
                if (Test-Path $envFile) {
                    $envContent = Get-Content $envFile -Raw
                    if ($envContent -match "^DATABASE_URL=") {
                        # Update existing
                        $envContent = $envContent -replace "(?m)^DATABASE_URL=.*$", "DATABASE_URL=$databaseUrl"
                        Set-Content -Path $envFile -Value $envContent
                    } else {
                        # Append
                        Add-Content -Path $envFile -Value ""
                        Add-Content -Path $envFile -Value "# PostgreSQL database URL"
                        Add-Content -Path $envFile -Value "DATABASE_URL=$databaseUrl"
                    }
                } else {
                    # Create new file
                    Set-Content -Path $envFile -Value "# PostgreSQL database URL"
                    Add-Content -Path $envFile -Value "DATABASE_URL=$databaseUrl"
                }
                Write-Host ""
                Write-Color "PostgreSQL configured!" "Green"
            } else {
                Write-Host ""
                Write-Color "No URL provided, using SQLite." "Yellow"
            }
        } else {
            Write-Host ""
            Write-Host "Using " -NoNewline
            Write-Color "SQLite" "Cyan" -NoNewline
            Write-Host " (default). Data will be stored in $installDir\data\"
        }

        Write-Host ""
    } else {
        Write-Color "Existing configuration preserved." "Green"
        Write-Host ""
    }

    # Check if already in PATH
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    $pathAdded = $false

    if ($currentPath -and $currentPath.Contains($installDir)) {
        Write-Color "Moneywright is already in your PATH." "Green"
        $pathAdded = $true
    } else {
        # Ask user if they want to add to PATH
        Write-Color "Would you like to add Moneywright to your PATH?" "Yellow"
        Write-Host "This will let you run 'moneywright' from anywhere."
        Write-Host ""
        $addToPath = Read-Host "Add to PATH? (Y/n)"

        if ($addToPath -ne "n" -and $addToPath -ne "N") {
            # Add to user PATH
            $newPath = if ($currentPath) { "$currentPath;$installDir" } else { $installDir }
            [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")

            # Also update current session
            $env:PATH = "$env:PATH;$installDir"

            Write-Host ""
            Write-Color "Added to PATH!" "Green"
            Write-Host "Restart PowerShell to use 'moneywright' command from anywhere."
            $pathAdded = $true
        } else {
            Write-Host ""
            Write-Host "To add to PATH later, run:"
            Write-Host "  " -NoNewline
            Write-Color "[Environment]::SetEnvironmentVariable(`"PATH`", `$env:PATH + `";$installDir`", `"User`")" "Cyan"
        }
    }

    Write-Host ""
    Write-Host "For more info: " -NoNewline
    Write-Color "https://github.com/$repo" "Cyan"
    Write-Host ""

    # Ask if user wants to start now
    Write-Color "Would you like to start Moneywright now?" "Yellow"
    $start = Read-Host "Start now? (Y/n)"
    if ($start -ne "n" -and $start -ne "N") {
        Write-Host ""
        Write-Color "Starting Moneywright..." "Green"
        Write-Host ""
        & "$installDir\moneywright.exe"
    } else {
        Write-Host ""
        Write-Host "To start Moneywright later, run:"
        Write-Host "  " -NoNewline
        if ($pathAdded) {
            Write-Color "moneywright" "Cyan"
        } else {
            Write-Color "& `"$installDir\moneywright.exe`"" "Cyan"
        }
        Write-Host ""
    }

} finally {
    # Cleanup temp directory
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
