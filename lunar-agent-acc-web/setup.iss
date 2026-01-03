#define MyAppName "장애인호출관리시스템"
#define MyAppVersion "2.2.0"
#define MyAppPublisher "NEcall"
#define MyAppURL "https://lnsmsadmin.lunarsystem.co.kr"
#define MyAppExeName "CareReceiverAgent.Host.exe"
#define MyAppId "{{A1B2C3D4-E5F6-4A5B-8C9D-0E1F2A3B4C5D}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName=c:\lnsmsacc
DefaultGroupName=NEcall
AllowNoIcons=yes
LicenseFile=
InfoBeforeFile=
InfoAfterFile=
OutputDir=installer
OutputBaseFilename=장애인호출관리시스템_Setup
SetupIconFile=CareReceiverAgent.Host\app.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
DisableWelcomePage=yes
DisableReadyPage=yes
DisableFinishedPage=yes
DisableDirPage=no
AllowRootDirectory=yes
DisableReadyMemo=yes
DisableStartupPrompt=yes

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Tasks]
Name: "desktopicon"; Description: "데스크톱에 아이콘 만들기"; GroupDescription: "추가 아이콘:"; Flags: checkedonce

[Files]
Source: "CareReceiverAgent.Host\bin\Release\net9.0-windows\win-x64\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "CareReceiverAgent.Host\app.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\app.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\app.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{#MyAppName} 실행"; Flags: nowait postinstall skipifsilent

[Code]
procedure InitializeWizard;
begin
  // WizardForm이 완전히 초기화된 후에만 접근
  try
    WizardForm.DirEdit.Text := 'c:\lnsmsacc';
  except
    // 초기화 단계에서는 무시
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpSelectDir then
  begin
    WizardForm.DirEdit.Text := 'c:\lnsmsacc';
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = wpSelectDir then
  begin
    if WizardForm.DirEdit.Text = '' then
      WizardForm.DirEdit.Text := 'c:\lnsmsacc';
  end;
end;

function IsProcessRunning(ProcessName: String): Boolean;
var
  ResultCode: Integer;
  TempFile: String;
  Output: AnsiString;
begin
  Result := False;
  TempFile := ExpandConstant('{tmp}\process_check.txt');
  
  // tasklist로 프로세스 확인하고 결과를 파일로 저장
  if Exec('cmd', '/C tasklist /FI "IMAGENAME eq ' + ProcessName + '" | find "' + ProcessName + '" > "' + TempFile + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    // 파일이 존재하고 크기가 0보다 크면 프로세스가 실행 중
    if FileExists(TempFile) then
    begin
      if LoadStringFromFile(TempFile, Output) then
      begin
        Result := (Length(Output) > 0);
      end;
      DeleteFile(TempFile);
    end;
  end;
end;


function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
  ProcessName: String;
  RetryCount: Integer;
begin
  Result := True;
  
  // 관리자 권한 확인
  if not IsAdmin then
  begin
    MsgBox('이 설치 프로그램은 관리자 권한이 필요합니다.' + #13#10 + 
           '설치 프로그램을 마우스 오른쪽 버튼으로 클릭하고 "관리자 권한으로 실행"을 선택해주세요.', 
           mbError, MB_OK);
    Result := False;
    Exit;
  end;
  
  ProcessName := 'CareReceiverAgent.Host.exe';
  
  // 실행 중인 프로세스 종료 시도
  RetryCount := 0;
  while RetryCount < 3 do
  begin
    Exec('taskkill', '/F /IM ' + ProcessName + ' /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(500);
    
    if not IsProcessRunning(ProcessName) then
    begin
      Break;
    end;
    
    RetryCount := RetryCount + 1;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  ExePath: String;
  StartupPath: String;
  LinkPath: String;
  PowerShellScript: String;
begin
  if CurStep = ssPostInstall then
  begin
    ExePath := ExpandConstant('{app}\{#MyAppExeName}');
    
    // Common Startup 폴더 경로 (모든 사용자에게 적용)
    // shell:common startup = C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup
    StartupPath := ExpandConstant('{commonstartup}');
    LinkPath := StartupPath + '\{#MyAppName}.lnk';
    
    try
      // 상태창 표시 (안전성 체크)
      try
        WizardForm.StatusLabel.Caption := '시작 프로그램에 등록하는 중...';
        WizardForm.Update;
      except
      end;
      
      // 시작 프로그램에 바로가기 생성
      // IShellLink를 사용하거나 간단하게 CreateShellLink 사용
      // Inno Setup의 CreateShellLink는 [Icons] 섹션에서만 사용 가능하므로
      // 직접 레지스트리나 파일 시스템을 사용해야 함
      // 대신 [Icons] 섹션에서 {commonstartup} 사용 불가하므로 여기서 직접 생성
      
      // PowerShell을 사용하여 바로가기 생성 (더 안정적인 방법)
      PowerShellScript := ExpandConstant('{tmp}\create_shortcut.ps1');
      
      // PowerShell 스크립트 파일 생성
      SaveStringToFile(PowerShellScript,
        '$WshShell = New-Object -ComObject WScript.Shell' + #13#10 +
        '$Shortcut = $WshShell.CreateShortcut("' + LinkPath + '")' + #13#10 +
        '$Shortcut.TargetPath = "' + ExePath + '"' + #13#10 +
        '$Shortcut.WorkingDirectory = "' + ExpandConstant('{app}') + '"' + #13#10 +
        '$Shortcut.IconLocation = "' + ExePath + ',0"' + #13#10 +
        '$Shortcut.Save()', False);
      
      // PowerShell 스크립트 실행
      Exec('powershell', 
        '-ExecutionPolicy Bypass -File "' + PowerShellScript + '"',
        '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      
      // 임시 파일 삭제
      if FileExists(PowerShellScript) then
      begin
        DeleteFile(PowerShellScript);
      end;
      
      if ResultCode = 0 then
      begin
        try
          WizardForm.StatusLabel.Caption := '시작 프로그램에 등록되었습니다.';
          WizardForm.Update;
        except
        end;
      end
      else
      begin
        MsgBox('시작 프로그램 등록에 실패했습니다. 수동으로 등록해주세요.', mbInformation, MB_OK);
      end;
    except
      MsgBox('시작 프로그램 등록 중 오류가 발생했습니다.', mbInformation, MB_OK);
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  StartupPath: String;
  LinkPath: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    // 시작 프로그램에서 바로가기 제거
    StartupPath := ExpandConstant('{commonstartup}');
    LinkPath := StartupPath + '\{#MyAppName}.lnk';
    
    if FileExists(LinkPath) then
    begin
      DeleteFile(LinkPath);
    end;
  end;
end;

