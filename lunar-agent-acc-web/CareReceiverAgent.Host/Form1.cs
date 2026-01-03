using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;
using System.Drawing;
using System.Runtime.InteropServices;

namespace CareReceiverAgent.Host;

public partial class Form1 : Form
{
    private WebView2? _webView;
    private string _backendUrl;
    private NotifyIcon? _notifyIcon;
    private bool _isClosing = false;
    private static Form1? _instance;
    
    // Windows API 상수
    private const int WM_NCHITTEST = 0x0084;
    private const int HTCLIENT = 0x1;
    private const int HTCAPTION = 0x2;
    private const int DRAG_AREA_HEIGHT = 120; // 상단 드래그 가능 영역 높이 (픽셀)

    public Form1(int port)
    {
        _backendUrl = $"http://localhost:{port}";
        _instance = this;
        
        InitializeComponent();
        
        // 창 제목 설정
        this.Text = "장애인 도움요청 시스팀";
        
        // 초기에는 창을 숨김
        this.WindowState = FormWindowState.Minimized;
        this.ShowInTaskbar = false;
        
        InitializeTrayIcon();
        InitializeWebView();
        
        this.Hide();
    }
    
    private void Form1_Paint(object sender, PaintEventArgs e)
    {
        // 흑색 1px 보더 그리기
        using (Pen borderPen = new Pen(Color.Black, 1))
        {
            Rectangle borderRect = new Rectangle(0, 0, this.ClientSize.Width - 1, this.ClientSize.Height - 1);
            e.Graphics.DrawRectangle(borderPen, borderRect);
        }
    }
    
    protected override void WndProc(ref Message m)
    {
        // WM_NCHITTEST 메시지 처리 (창 드래그)
        if (m.Msg == WM_NCHITTEST)
        {
            base.WndProc(ref m);
            
            // 클라이언트 영역 내에서 클릭한 경우
            if (m.Result.ToInt32() == HTCLIENT)
            {
                // LParam에서 스크린 좌표 추출
                int x = (int)(m.LParam.ToInt64() & 0xFFFF);
                int y = (int)((m.LParam.ToInt64() >> 16) & 0xFFFF);
                Point screenPoint = new Point(x, y);
                
                // 클라이언트 좌표로 변환
                Point clientPoint = this.PointToClient(screenPoint);
                
                // 상단 영역 (드래그 가능 영역)인지 확인
                if (clientPoint.Y < DRAG_AREA_HEIGHT)
                {
                    // 캡션 바로 처리하여 드래그 가능하게 함
                    m.Result = new IntPtr(HTCAPTION);
                    return;
                }
            }
            
            return;
        }
        
        base.WndProc(ref m);
    }
    
    public static void ShowNotificationWindow()
    {
        if (_instance != null && !_instance.IsDisposed)
        {
            _instance.Invoke((MethodInvoker)delegate
            {
                // 항상 Normal 상태로 복원
                _instance.WindowState = FormWindowState.Normal;
                
                _instance.Show();
                _instance.ShowInTaskbar = true;
                _instance.Activate();
                
                // 모니터 중앙에 배치
                _instance.CenterToScreen();
                
                // 알림창으로 이동
                _instance.NavigateToNotification();
            });
        }
    }
    
    public static void HideWindow()
    {
        if (_instance != null && !_instance.IsDisposed)
        {
            _instance.Invoke((MethodInvoker)delegate
            {
                _instance.ShowInTaskbar = false;
                _instance.Hide();
            });
        }
    }
    
    private async void NavigateToNotification()
    {
        // 백엔드가 준비될 때까지 대기
        await WaitForBackend();
        
        if (_webView?.CoreWebView2 != null)
        {
            // 알림창으로 이동 (view 파라미터 없음)
            _webView.CoreWebView2.Navigate(_backendUrl);
        }
    }

    private void InitializeTrayIcon()
    {
        try
        {
            // Designer에서 생성된 components 사용
            if (this.components == null)
            {
                this.components = new System.ComponentModel.Container();
            }

            // 아이콘 파일 로드
            Icon? trayIcon = null;
            var iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app.ico");
            if (File.Exists(iconPath))
            {
                try
                {
                    trayIcon = new Icon(iconPath);
                }
                catch
                {
                    // 아이콘 로드 실패 시 기본 아이콘 사용
                }
            }

            _notifyIcon = new NotifyIcon(this.components)
            {
                Icon = trayIcon ?? SystemIcons.Application,
                Text = "장애인 도움요청 시스팀"
            };

            // 컨텍스트 메뉴 생성
            var contextMenu = new ContextMenuStrip();
            var openMenuItem = new ToolStripMenuItem("열기");
            var exitMenuItem = new ToolStripMenuItem("닫기");

            openMenuItem.Click += (s, e) => ShowWindow();
            exitMenuItem.Click += (s, e) => ExitApplication();

            contextMenu.Items.Add(openMenuItem);
            contextMenu.Items.Add(new ToolStripSeparator());
            contextMenu.Items.Add(exitMenuItem);

            _notifyIcon.ContextMenuStrip = contextMenu;
            // 트레이 아이콘 더블 클릭 시 알림 화면 표시
            _notifyIcon.DoubleClick += (s, e) => ShowNotificationWindow();
            
            // 트레이 아이콘이 보이도록 설정
            _notifyIcon.Visible = true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"트레이 아이콘 초기화 실패: {ex.Message}");
        }
    }

    private void ShowWindow()
    {
        // 항상 Normal 상태로 복원
        this.WindowState = FormWindowState.Normal;
        
        this.Show();
        this.ShowInTaskbar = true;
        this.Activate();
        
        // 모니터 중앙에 배치
        CenterToScreen();
        
        // 기능 설정 페이지로 이동 (기본 페이지)
        NavigateToSettings();
    }

    private async void NavigateToSettings()
    {
        // 백엔드가 준비될 때까지 대기
        await WaitForBackend();
        
        if (_webView?.CoreWebView2 != null)
        {
            var settingsUrl = $"{_backendUrl}?view=settings";
            _webView.CoreWebView2.Navigate(settingsUrl);
        }
    }

    private void ExitApplication()
    {
        _isClosing = true;
        if (_notifyIcon != null)
        {
            _notifyIcon.Visible = false;
        }
        this.Close();
    }

    private void InitializeWebView()
    {
        _webView = new WebView2
        {
            Dock = DockStyle.Fill
        };
        Controls.Add(_webView);

        _webView.CoreWebView2InitializationCompleted += WebView_CoreWebView2InitializationCompleted;
        _webView.NavigationCompleted += WebView_NavigationCompleted;

        // WebView2 초기화
        _webView.EnsureCoreWebView2Async();
    }

    private void WebView_CoreWebView2InitializationCompleted(object? sender, CoreWebView2InitializationCompletedEventArgs e)
    {
        if (e.IsSuccess && _webView?.CoreWebView2 != null)
        {
            var settings = _webView.CoreWebView2.Settings;
            
            // 개발자 도구 비활성화
            settings.AreDevToolsEnabled = false;
            
            // 특수키 및 단축키 차단
            settings.AreBrowserAcceleratorKeysEnabled = false;
            
            // 컨텍스트 메뉴 비활성화 (우클릭 차단)
            settings.AreDefaultContextMenusEnabled = false;
            
            // 스크립트 디버깅 비활성화
            settings.IsScriptEnabled = true; // 스크립트는 필요하지만 디버깅은 차단
            
            // 웹 메시지 처리
            _webView.CoreWebView2.WebMessageReceived += WebView_WebMessageReceived;
            
            // 백엔드 URL로 이동
            NavigateToBackend();
        }
    }
    
    private void WebView_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        // 웹 메시지 처리 (필요시)
    }
    
    private async Task InjectSecurityScripts()
    {
        if (_webView?.CoreWebView2 == null) return;
        
        // 보안 스크립트 주입: 특수키, 우클릭, 개발자 도구 단축키 차단
        var securityScript = @"
            (function() {
                // 우클릭 차단
                document.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    return false;
                }, true);
                
                // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U 등 차단
                document.addEventListener('keydown', function(e) {
                    // F12
                    if (e.keyCode === 123) {
                        e.preventDefault();
                        return false;
                    }
                    // Ctrl+Shift+I (개발자 도구)
                    if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
                        e.preventDefault();
                        return false;
                    }
                    // Ctrl+Shift+J (콘솔)
                    if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
                        e.preventDefault();
                        return false;
                    }
                    // Ctrl+U (소스보기)
                    if (e.ctrlKey && e.keyCode === 85) {
                        e.preventDefault();
                        return false;
                    }
                    // Ctrl+S (저장)
                    if (e.ctrlKey && e.keyCode === 83) {
                        e.preventDefault();
                        return false;
                    }
                    // Ctrl+P (인쇄)
                    if (e.ctrlKey && e.keyCode === 80) {
                        e.preventDefault();
                        return false;
                    }
                    // Ctrl+Shift+C (요소 검사)
                    if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
                        e.preventDefault();
                        return false;
                    }
                }, true);
                
                // 선택 차단 (일부)
                document.addEventListener('selectstart', function(e) {
                    e.preventDefault();
                    return false;
                }, true);
                
                // 드래그 차단
                document.addEventListener('dragstart', function(e) {
                    e.preventDefault();
                    return false;
                }, true);
            })();
        ";
        
        await _webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(securityScript);
    }

    private async void WebView_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (e.IsSuccess)
        {
            this.Text = "장애인 도움요청 시스팀";
            // 페이지 로드 완료 후 보안 스크립트 주입
            await InjectSecurityScripts();
        }
    }

    private async void NavigateToBackend()
    {
        // 백엔드가 준비될 때까지 대기
        await WaitForBackend();
        
        if (_webView?.CoreWebView2 != null)
        {
            _webView.CoreWebView2.Navigate(_backendUrl);
        }
    }

    private async Task WaitForBackend()
    {
        using var httpClient = new HttpClient();
        httpClient.Timeout = TimeSpan.FromSeconds(1);

        for (int i = 0; i < 30; i++)
        {
            try
            {
                var response = await httpClient.GetAsync(_backendUrl);
                if (response.IsSuccessStatusCode)
                {
                    return;
                }
            }
            catch
            {
                // 백엔드가 아직 준비되지 않음
            }

            await Task.Delay(500);
        }
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (!_isClosing)
        {
            // 트레이로 숨김 (CloseQuery 사용)
            // WindowState를 변경하지 않고 단순히 숨김만 처리
            e.Cancel = true;
            this.ShowInTaskbar = false;
            this.Hide();
            return;
        }

        // 웹서버 종료
        Program.StopWebServer();

        // 트레이 아이콘 정리
        if (_notifyIcon != null)
        {
            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
        }

        base.OnFormClosing(e);
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        
        if (this.WindowState == FormWindowState.Minimized)
        {
            this.ShowInTaskbar = false;
            this.Hide();
        }
    }
}
