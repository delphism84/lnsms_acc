using System;
using System.Collections.Generic;
using System.Configuration;
using System.Drawing;
using System.IO;
using System.Linq;
using System.ServiceProcess;
using System.Windows.Forms;
using SkiaSharp;
using SkiaSharp.Views.Desktop;

namespace CareReceiverAgent
{
    public partial class FormAgentSkia : Form
    {
        private SKControl _skControl;
        private Timer _animationTimer;
        private Timer _updateTimer;
        private float _glowAnimation = 0f;
        private int _selectedTab = 0;
        private readonly string[] _tabNames = { "상태", "기능설정", "벨 설정", "문구 설정", "설정" };
        
        // 한글 폰트 캐싱
        private SKTypeface _koreanFont;
        private SKTypeface _koreanFontBold;
        
        // 다크 테마 색상
        private readonly SKColor _bgDark = new SKColor(30, 30, 30);
        private readonly SKColor _bgDarker = new SKColor(20, 20, 20);
        private readonly SKColor _bgLight = new SKColor(45, 45, 45);
        private readonly SKColor _accentColor = new SKColor(0, 150, 255);
        private readonly SKColor _textColor = new SKColor(240, 240, 240);
        private readonly SKColor _textSecondary = new SKColor(180, 180, 180);
        private readonly SKColor _borderColor = new SKColor(60, 60, 60);
        private readonly SKColor _successColor = new SKColor(0, 255, 100);
        private readonly SKColor _errorColor = new SKColor(255, 100, 100);

        // 데이터 관리
        private BellConfig _bellConfig;
        private PhrasesConfig _phrasesConfig;
        private TtsSettings _ttsSettings;
        private ServiceSettings _serviceSettings;
        private StatusSettings _statusSettings;
        private FunctionSettingsConfig _functionSettings;
        private TtsManager _ttsManager;
        private CareReceiverService _service;
        private SerialPortHandler _serialPortHandler;
        
        // 상태 카드 위치 저장 (더블클릭 감지용)
        private SKRect _callStatusCardRect;
        private SKRect _serialStatusCardRect;

        // UI 상태
        private List<BellInfo> _displayBells = new List<BellInfo>();
        private List<PhraseData> _displayPhrases = new List<PhraseData>();
        private int _selectedBellIndex = -1;
        private int _selectedPhraseIndex = -1;
        private string _editingBellCode = "";
        private string _editingBellName = "";
        private string _editingPhraseText = "";
        private bool _isEditing = false;

        // 스크롤 위치
        private float _bellScrollY = 0;
        private float _phraseScrollY = 0;
        private float _settingsScrollY = 0;
        private float _functionScrollY = 0;
        private const float ScrollSpeed = 20f;
        
        // 기능설정 탭 상태
        private int _selectedFunctionIndex = -1;
        private string _editingFunctionId = "";
        private SKColor _selectedFunctionColor = SKColor.Parse("#FF0000");
        private List<SKRect> _functionItemRects = new List<SKRect>();
        private List<SKRect> _functionColorButtonRects = new List<SKRect>();
        private SKRect _idInputRect;
        private SKRect _ttsToggleRect;
        private SKRect _comPortRect;
        private SKRect _bellAddRect;
        private SKRect _bellDeleteRect;

        public FormAgentSkia(CareReceiverService service = null)
        {
            _service = service;
            _serialPortHandler = service?.SerialPortHandler;
            InitializeComponent();
            InitializeAnimation();
            InitializeData();
            InitializeFonts();
        }

        private void InitializeComponent()
        {
            this.SuspendLayout();

            this.Text = "Care Receiver Agent";
            this.Size = new Size(1200, 800);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.Sizable;
            this.MinimizeBox = true;
            this.MaximizeBox = true;
            this.BackColor = Color.FromArgb(30, 30, 30);

            _skControl = new SKControl
            {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(30, 30, 30)
            };
            _skControl.PaintSurface += SkControl_PaintSurface;
            _skControl.MouseDown += SkControl_MouseDown;
            _skControl.MouseDoubleClick += SkControl_MouseDoubleClick;
            _skControl.MouseMove += SkControl_MouseMove;
            _skControl.MouseUp += SkControl_MouseUp;
            _skControl.MouseWheel += SkControl_MouseWheel;
            this.Controls.Add(_skControl);

            this.ResumeLayout(false);
        }

        private void InitializeFonts()
        {
            try
            {
                // 한글 폰트 로드 (맑은 고딕)
                _koreanFont = SKTypeface.FromFamilyName("맑은 고딕", SKFontStyle.Normal);
                _koreanFontBold = SKTypeface.FromFamilyName("맑은 고딕", SKFontStyle.Bold);
                
                // 폰트 로드 실패 시 시스템 기본 폰트 사용
                if (_koreanFont == null)
                {
                    _koreanFont = SKTypeface.FromFamilyName("Malgun Gothic", SKFontStyle.Normal);
                    _koreanFontBold = SKTypeface.FromFamilyName("Malgun Gothic", SKFontStyle.Bold);
                }
            }
            catch
            {
                // 폰트 로드 실패 시 기본 폰트 사용
                _koreanFont = SKTypeface.Default;
                _koreanFontBold = SKTypeface.Default;
            }
        }

        private void InitializeData()
        {
            _bellConfig = BellConfig.Load();
            _phrasesConfig = PhrasesConfig.Load();
            _ttsSettings = TtsSettings.Load();
            _serviceSettings = ServiceSettings.Load();
            _statusSettings = StatusSettings.Load();
            _functionSettings = FunctionSettingsConfig.Load();
            _ttsManager = new TtsManager();
            
            RefreshBellList();
            RefreshPhraseList();
            RefreshFunctionList();
        }
        
        private void RefreshFunctionList()
        {
            _skControl?.Invalidate();
        }

        private void RefreshBellList()
        {
            _displayBells = _bellConfig.Bells.ToList();
            _skControl?.Invalidate();
        }

        private void RefreshPhraseList()
        {
            _displayPhrases = _phrasesConfig.Phrases.ToList();
            _skControl?.Invalidate();
        }

        private void InitializeAnimation()
        {
            _animationTimer = new Timer { Interval = 16 }; // ~60fps
            _animationTimer.Tick += (s, e) =>
            {
                _glowAnimation += 0.05f;
                if (_glowAnimation > Math.PI * 2) _glowAnimation = 0;
                _skControl.Invalidate();
            };
            _animationTimer.Start();

            _updateTimer = new Timer { Interval = 1000 }; // 1초마다 상태 업데이트
            _updateTimer.Tick += (s, e) => _skControl.Invalidate();
            _updateTimer.Start();
        }

        private void SkControl_PaintSurface(object sender, SKPaintSurfaceEventArgs e)
        {
            var canvas = e.Surface.Canvas;
            var info = e.Info;
            
            canvas.Clear(_bgDark);

            DrawAppBar(canvas, info);
            DrawTabBar(canvas, info);
            DrawContent(canvas, info);
        }

        private void DrawAppBar(SKCanvas canvas, SKImageInfo info)
        {
            var appBarHeight = 50;
            var rect = new SKRect(0, 0, info.Width, appBarHeight);

            using (var paint = new SKPaint { Color = _bgDarker })
            {
                canvas.DrawRect(rect, paint);
            }

            // 제목 텍스트
            using (var paint = new SKPaint
            {
                Color = _textColor,
                TextSize = 18,
                IsAntialias = true,
                Typeface = _koreanFontBold
            })
            {
                canvas.DrawText("Care Receiver Agent", 15, appBarHeight / 2 + 6, paint);
            }

            using (var paint = new SKPaint { Color = _borderColor, StrokeWidth = 1 })
            {
                canvas.DrawLine(0, appBarHeight, info.Width, appBarHeight, paint);
            }
        }

        private void DrawTabBar(SKCanvas canvas, SKImageInfo info)
        {
            var appBarHeight = 50;
            var tabBarHeight = 40;
            var tabBarY = appBarHeight;
            var tabWidth = info.Width / _tabNames.Length;

            var tabBarRect = new SKRect(0, tabBarY, info.Width, tabBarY + tabBarHeight);
            using (var paint = new SKPaint { Color = _bgLight })
            {
                canvas.DrawRect(tabBarRect, paint);
            }

            for (int i = 0; i < _tabNames.Length; i++)
            {
                var tabRect = new SKRect(i * tabWidth, tabBarY, (i + 1) * tabWidth, tabBarY + tabBarHeight);
                var isSelected = i == _selectedTab;

                if (isSelected)
                {
                    using (var paint = new SKPaint { Color = _bgDark })
                    {
                        canvas.DrawRect(tabRect, paint);
                    }
                }

                using (var paint = new SKPaint
                {
                    Color = isSelected ? _accentColor : _textSecondary,
                    TextSize = 14,
                    IsAntialias = true,
                    Typeface = isSelected ? _koreanFontBold : _koreanFont
                })
                {
                    var textBounds = new SKRect();
                    paint.MeasureText(_tabNames[i], ref textBounds);
                    var x = tabRect.MidX - textBounds.Width / 2;
                    var y = tabRect.MidY + textBounds.Height / 2;
                    canvas.DrawText(_tabNames[i], x, y, paint);
                }

                if (isSelected)
                {
                    using (var paint = new SKPaint { Color = _accentColor, StrokeWidth = 2 })
                    {
                        canvas.DrawLine(tabRect.Left, tabRect.Bottom, tabRect.Right, tabRect.Bottom, paint);
                    }
                }
            }
        }

        private void DrawContent(SKCanvas canvas, SKImageInfo info)
        {
            var appBarHeight = 50;
            var tabBarHeight = 40;
            var contentY = appBarHeight + tabBarHeight;
            var contentRect = new SKRect(10, contentY + 10, info.Width - 10, info.Height - 10);

            using (var paint = new SKPaint { Color = _bgLight, IsAntialias = true })
            {
                canvas.DrawRoundRect(contentRect, 5, 5, paint);
            }

            var glowIntensity = (float)(Math.Sin(_glowAnimation) * 0.3 + 0.7);
            var glowColor = new SKColor(
                (byte)(_accentColor.Red * glowIntensity),
                (byte)(_accentColor.Green * glowIntensity),
                (byte)(_accentColor.Blue * glowIntensity),
                (byte)(255 * glowIntensity)
            );

            using (var paint = new SKPaint
            {
                Style = SKPaintStyle.Stroke,
                Color = glowColor,
                StrokeWidth = 1,
                IsAntialias = true
            })
            {
                canvas.DrawRoundRect(contentRect, 5, 5, paint);
            }

            var innerRect = new SKRect(contentRect.Left + 15, contentRect.Top + 15, contentRect.Right - 15, contentRect.Bottom - 15);
            
            switch (_selectedTab)
            {
                case 0: DrawStatusTab(canvas, innerRect); break;
                case 1: DrawFunctionSettingsTab(canvas, innerRect); break;
                case 2: DrawBellSettingsTab(canvas, innerRect); break;
                case 3: DrawPhraseSettingsTab(canvas, innerRect); break;
                case 4: DrawServiceManagementTab(canvas, innerRect); break;
            }
        }

        private void DrawStatusTab(SKCanvas canvas, SKRect rect)
        {
            var y = rect.Top + 10;

            // 호출 상태 카드
            _callStatusCardRect = new SKRect(rect.Left, y, rect.Left + (rect.Width / 2) - 10, y + 90);
            var hasActiveCall = false; // TODO: 실제 호출 상태 확인
            DrawStatusCard(canvas, _callStatusCardRect, "호출 상태", hasActiveCall ? "호출 중" : "정상", !hasActiveCall);

            // 시리얼 통신 상태 카드
            _serialStatusCardRect = new SKRect(rect.Left + (rect.Width / 2) + 10, y, rect.Right, y + 90);
            var isSerialConnected = _serialPortHandler?.IsConnected ?? false;
            DrawStatusCard(canvas, _serialStatusCardRect, "시리얼 통신", isSerialConnected ? "연결됨" : "연결 안됨", isSerialConnected);

            y += 110;

            // 음성/팝업 토글 버튼
            var toggleY = y;
            var toggleWidth = 120f;
            var toggleHeight = 35f;
            var toggleSpacing = 15f;

            // 음성 ON/OFF
            var soundToggleRect = new SKRect(rect.Left, toggleY, rect.Left + toggleWidth, toggleY + toggleHeight);
            DrawToggleButton(canvas, soundToggleRect, "음성", _statusSettings.SoundEnabled);

            // 팝업 ON/OFF
            var popupToggleRect = new SKRect(rect.Left + toggleWidth + toggleSpacing, toggleY, rect.Left + toggleWidth * 2 + toggleSpacing, toggleY + toggleHeight);
            DrawToggleButton(canvas, popupToggleRect, "팝업", _statusSettings.PopupEnabled);

            y += 50;

            // COM 포트 정보
            if (_serialPortHandler != null)
            {
                using (var paint = new SKPaint
                {
                    Color = _textSecondary,
                    TextSize = 12,
                    IsAntialias = true,
                    Typeface = _koreanFont
                })
                {
                    var portInfo = $"COM 포트: {GetComPort()}";
                    canvas.DrawText(portInfo, rect.Left, y, paint);
                }
            }
        }

        private void DrawToggleButton(SKCanvas canvas, SKRect rect, string label, bool isOn)
        {
            var bgColor = isOn ? _accentColor : _bgDarker;
            using (var paint = new SKPaint { Color = bgColor, IsAntialias = true })
            {
                canvas.DrawRoundRect(rect, 5, 5, paint);
            }

            using (var paint = new SKPaint
            {
                Color = _textColor,
                TextSize = 12,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                var text = $"{label}: {(isOn ? "ON" : "OFF")}";
                var textBounds = new SKRect();
                paint.MeasureText(text, ref textBounds);
                var x = rect.MidX - textBounds.Width / 2;
                var y = rect.MidY + textBounds.Height / 2;
                canvas.DrawText(text, x, y, paint);
            }
        }

        private string GetComPort()
        {
            try
            {
                return System.Configuration.ConfigurationManager.AppSettings["ComPort"] ?? "COM1";
            }
            catch
            {
                return "COM1";
            }
        }

        private void DrawStatusCard(SKCanvas canvas, SKRect rect, string title, string status, bool isActive)
        {
            using (var paint = new SKPaint { Color = _bgDarker, IsAntialias = true })
            {
                canvas.DrawRoundRect(rect, 5, 5, paint);
            }

            var glowIntensity = (float)(Math.Sin(_glowAnimation) * 0.2 + 0.5);
            var glowColor = new SKColor(
                (byte)(_accentColor.Red * glowIntensity),
                (byte)(_accentColor.Green * glowIntensity),
                (byte)(_accentColor.Blue * glowIntensity),
                (byte)(100 * glowIntensity)
            );

            using (var paint = new SKPaint
            {
                Style = SKPaintStyle.Stroke,
                Color = glowColor,
                StrokeWidth = 1,
                IsAntialias = true
            })
            {
                canvas.DrawRoundRect(rect, 5, 5, paint);
            }

            using (var paint = new SKPaint
            {
                Color = _textSecondary,
                TextSize = 12,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                canvas.DrawText(title, rect.Left + 10, rect.Top + 20, paint);
            }

            using (var paint = new SKPaint
            {
                Color = isActive ? _successColor : _errorColor,
                TextSize = 18,
                IsAntialias = true,
                Typeface = _koreanFontBold
            })
            {
                canvas.DrawText(status, rect.Left + 10, rect.Top + 50, paint);
            }
        }

        private void DrawFunctionSettingsTab(SKCanvas canvas, SKRect rect)
        {
            var y = rect.Top + 10;

            // 제목 "기능설정"
            using (var paint = new SKPaint
            {
                Color = _textColor,
                TextSize = 18,
                IsAntialias = true,
                Typeface = _koreanFontBold
            })
            {
                canvas.DrawText("기능설정", rect.Left + rect.Width / 2 - 40, y, paint);
            }
            y += 35;

            // 스크롤 가능한 기능 리스트 영역
            var listRect = new SKRect(rect.Left + 10, y, rect.Right - 10, rect.Bottom - 120);
            DrawFunctionList(canvas, listRect);

            // 하단 입력/버튼 영역
            var bottomY = rect.Bottom - 110;
            
            // ID 입력 필드
            using (var paint = new SKPaint
            {
                Color = _textSecondary,
                TextSize = 12,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                canvas.DrawText("ID:", rect.Left + 10, bottomY, paint);
            }
            
            _idInputRect = new SKRect(rect.Left + 50, bottomY - 18, rect.Left + 150, bottomY + 2);
            using (var paint = new SKPaint { Color = _bgLight, IsAntialias = true })
            {
                canvas.DrawRoundRect(_idInputRect, 3, 3, paint);
            }
            
            using (var paint = new SKPaint
            {
                Color = _textColor,
                TextSize = 12,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                canvas.DrawText(_editingFunctionId, _idInputRect.Left + 5, _idInputRect.MidY + 4, paint);
            }
            bottomY += 30;

            // 버튼들: TTS On/Off, COMxx, 벨등록, 벨삭제
            var buttonWidth = 100f;
            var buttonHeight = 30f;
            var buttonSpacing = 10f;
            var buttonStartX = rect.Left + 10;

            _ttsToggleRect = new SKRect(buttonStartX, bottomY, buttonStartX + buttonWidth, bottomY + buttonHeight);
            DrawButton(canvas, _ttsToggleRect, $"TTS {(_ttsSettings.Enabled ? "On" : "Off")}", _ttsSettings.Enabled ? _successColor : _errorColor, () => ToggleTts());

            buttonStartX += buttonWidth + buttonSpacing;
            var comPort = GetComPort();
            _comPortRect = new SKRect(buttonStartX, bottomY, buttonStartX + buttonWidth, bottomY + buttonHeight);
            DrawButton(canvas, _comPortRect, comPort, _accentColor, () => EditSerialPortSettings());

            buttonStartX += buttonWidth + buttonSpacing;
            _bellAddRect = new SKRect(buttonStartX, bottomY, buttonStartX + buttonWidth, bottomY + buttonHeight);
            DrawButton(canvas, _bellAddRect, "벨등록", _accentColor, () => AddBellFromFunction());

            buttonStartX += buttonWidth + buttonSpacing;
            _bellDeleteRect = new SKRect(buttonStartX, bottomY, buttonStartX + buttonWidth, bottomY + buttonHeight);
            DrawButton(canvas, _bellDeleteRect, "벨삭제", _errorColor, () => DeleteBellByCode());

            // 하단 "<설정>" 텍스트
            using (var paint = new SKPaint
            {
                Color = _textSecondary,
                TextSize = 11,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                var settingsText = "<설정>";
                var textWidth = paint.MeasureText(settingsText);
                canvas.DrawText(settingsText, rect.Left + rect.Width / 2 - textWidth / 2, rect.Bottom - 10, paint);
            }
        }

        private void DrawFunctionList(SKCanvas canvas, SKRect rect)
        {
            _functionItemRects.Clear();
            _functionColorButtonRects.Clear();
            
            var itemHeight = 35f;
            var visibleCount = (int)(rect.Height / itemHeight);
            var startIndex = Math.Max(0, (int)(_functionScrollY / itemHeight));
            var functions = _functionSettings.Functions.OrderBy(f => f.Id).ToList();
            var endIndex = Math.Min(functions.Count, startIndex + visibleCount + 1);

            // 스크롤바 그리기
            if (functions.Count > visibleCount)
            {
                var scrollbarWidth = 15f;
                var scrollbarRect = new SKRect(rect.Right - scrollbarWidth, rect.Top, rect.Right, rect.Bottom);
                using (var paint = new SKPaint { Color = _bgDarker, IsAntialias = true })
                {
                    canvas.DrawRoundRect(scrollbarRect, 3, 3, paint);
                }
                
                var scrollbarHeight = rect.Height;
                var thumbHeight = scrollbarHeight * (rect.Height / (functions.Count * itemHeight));
                var thumbY = rect.Top + (_functionScrollY / (functions.Count * itemHeight - rect.Height)) * (scrollbarHeight - thumbHeight);
                var thumbRect = new SKRect(scrollbarRect.Left + 2, thumbY, scrollbarRect.Right - 2, thumbY + thumbHeight);
                using (var paint = new SKPaint { Color = _bgLight, IsAntialias = true })
                {
                    canvas.DrawRoundRect(thumbRect, 2, 2, paint);
                }
            }

            var listContentWidth = rect.Width - (functions.Count > visibleCount ? 20f : 0f);

            for (int i = startIndex; i < endIndex; i++)
            {
                var itemRect = new SKRect(rect.Left, rect.Top + i * itemHeight - _functionScrollY, rect.Left + listContentWidth, rect.Top + (i + 1) * itemHeight - _functionScrollY);
                if (itemRect.Bottom < rect.Top || itemRect.Top > rect.Bottom) continue;

                var func = functions[i];
                var isSelected = i == _selectedFunctionIndex;

                // 배경
                using (var paint = new SKPaint { Color = isSelected ? _accentColor : _bgDarker, IsAntialias = true })
                {
                    canvas.DrawRoundRect(itemRect, 5, 5, paint);
                }

                // 번호와 텍스트
                using (var paint = new SKPaint
                {
                    Color = _textColor,
                    TextSize = 12,
                    IsAntialias = true,
                    Typeface = _koreanFont
                })
                {
                    var text = $"{func.Id}: {func.Text}";
                    canvas.DrawText(text, itemRect.Left + 10, itemRect.MidY + 4, paint);
                }

                // 색상 선택 버튼 (우측에 작은 사각형)
                var colorButtonSize = 20f;
                var colorButtonRect = new SKRect(itemRect.Right - colorButtonSize - 10, itemRect.MidY - colorButtonSize / 2, itemRect.Right - 10, itemRect.MidY + colorButtonSize / 2);
                _functionColorButtonRects.Add(colorButtonRect);
                
                // 색상 버튼 배경
                var funcColor = SKColor.Parse(func.Color);
                using (var paint = new SKPaint { Color = funcColor, IsAntialias = true })
                {
                    canvas.DrawRoundRect(colorButtonRect, 2, 2, paint);
                }
                
                // 색상 버튼 테두리
                using (var paint = new SKPaint
                {
                    Style = SKPaintStyle.Stroke,
                    Color = _borderColor,
                    StrokeWidth = 1,
                    IsAntialias = true
                })
                {
                    canvas.DrawRoundRect(colorButtonRect, 2, 2, paint);
                }

                _functionItemRects.Add(itemRect);
            }
        }

        private void DrawBellSettingsTab(SKCanvas canvas, SKRect rect)
        {
            var y = rect.Top + 10;

            // 제목
            using (var paint = new SKPaint
            {
                Color = _textColor,
                TextSize = 16,
                IsAntialias = true,
                Typeface = _koreanFontBold
            })
            {
                canvas.DrawText("벨 관리", rect.Left, y, paint);
            }
            y += 30;

            // 벨 목록
            var listRect = new SKRect(rect.Left, y, rect.Right, rect.Bottom - 60);
            DrawBellList(canvas, listRect);

            // 추가/수정/삭제 버튼 영역
            var buttonY = rect.Bottom - 50;
            DrawButton(canvas, new SKRect(rect.Left, buttonY, rect.Left + 100, buttonY + 35), "벨 추가", _accentColor, () => AddBell());
            DrawButton(canvas, new SKRect(rect.Left + 110, buttonY, rect.Left + 210, buttonY + 35), "벨 수정", _accentColor, () => EditBell());
            DrawButton(canvas, new SKRect(rect.Left + 220, buttonY, rect.Left + 320, buttonY + 35), "벨 삭제", _errorColor, () => DeleteBell());
        }

        private void DrawBellList(SKCanvas canvas, SKRect rect)
        {
            var itemHeight = 40f;
            var visibleCount = (int)(rect.Height / itemHeight);
            var startIndex = Math.Max(0, (int)(_bellScrollY / itemHeight));
            var endIndex = Math.Min(_displayBells.Count, startIndex + visibleCount + 1);

            for (int i = startIndex; i < endIndex; i++)
            {
                var itemRect = new SKRect(rect.Left, rect.Top + i * itemHeight - _bellScrollY, rect.Right, rect.Top + (i + 1) * itemHeight - _bellScrollY);
                if (itemRect.Bottom < rect.Top || itemRect.Top > rect.Bottom) continue;

                var bell = _displayBells[i];
                var isSelected = i == _selectedBellIndex;

                // 배경
                using (var paint = new SKPaint { Color = isSelected ? _accentColor : _bgDarker, IsAntialias = true })
                {
                    canvas.DrawRoundRect(itemRect, 5, 5, paint);
                }

                // 텍스트
                using (var paint = new SKPaint
                {
                    Color = _textColor,
                    TextSize = 12,
                    IsAntialias = true,
                    Typeface = _koreanFont
                })
                {
                    var text = $"{bell.Code} - {bell.Name}";
                    canvas.DrawText(text, itemRect.Left + 10, itemRect.MidY + 4, paint);
                }
            }
        }

        private void DrawPhraseSettingsTab(SKCanvas canvas, SKRect rect)
        {
            var y = rect.Top + 10;

            // 제목
            using (var paint = new SKPaint
            {
                Color = _textColor,
                TextSize = 16,
                IsAntialias = true,
                Typeface = _koreanFontBold
            })
            {
                canvas.DrawText("문구 관리", rect.Left, y, paint);
            }
            y += 30;

            // 문구 목록 (1-20번)
            var listRect = new SKRect(rect.Left, y, rect.Left + rect.Width * 0.6f, rect.Bottom - 100);
            DrawPhraseList(canvas, listRect);

            // 선택된 문구 편집 영역
            if (_selectedPhraseIndex >= 0 && _selectedPhraseIndex < _displayPhrases.Count)
            {
                var editRect = new SKRect(rect.Left + rect.Width * 0.62f, y, rect.Right, rect.Bottom - 100);
                DrawPhraseEdit(canvas, editRect, _displayPhrases[_selectedPhraseIndex]);
            }

            // 버튼 영역
            var buttonY = rect.Bottom - 90;
            DrawButton(canvas, new SKRect(rect.Left, buttonY, rect.Left + 100, buttonY + 35), "문구 편집", _accentColor, () => EditPhrase());
            DrawButton(canvas, new SKRect(rect.Left + 110, buttonY, rect.Left + 230, buttonY + 35), "TTS 샘플 재생", _accentColor, () => PlayTtsSample());
            DrawButton(canvas, new SKRect(rect.Left + 240, buttonY, rect.Left + 360, buttonY + 35), "TTS 설정", _accentColor, () => ShowTtsSettings());
        }

        private void DrawPhraseList(SKCanvas canvas, SKRect rect)
        {
            var itemHeight = 30f;
            var visibleCount = (int)(rect.Height / itemHeight);
            var startIndex = Math.Max(0, (int)(_phraseScrollY / itemHeight));
            var endIndex = Math.Min(_displayPhrases.Count, startIndex + visibleCount + 1);

            for (int i = startIndex; i < endIndex; i++)
            {
                var itemRect = new SKRect(rect.Left, rect.Top + i * itemHeight - _phraseScrollY, rect.Right, rect.Top + (i + 1) * itemHeight - _phraseScrollY);
                if (itemRect.Bottom < rect.Top || itemRect.Top > rect.Bottom) continue;

                var phrase = _displayPhrases[i];
                var isSelected = i == _selectedPhraseIndex;

                using (var paint = new SKPaint { Color = isSelected ? _accentColor : _bgDarker, IsAntialias = true })
                {
                    canvas.DrawRoundRect(itemRect, 3, 3, paint);
                }

                using (var paint = new SKPaint
                {
                    Color = _textColor,
                    TextSize = 11,
                    IsAntialias = true,
                    Typeface = _koreanFont
                })
                {
                    var text = $"{phrase.Id}. {phrase.Text}";
                    canvas.DrawText(text, itemRect.Left + 5, itemRect.MidY + 3, paint);
                }
            }
        }

        private void DrawPhraseEdit(SKCanvas canvas, SKRect rect, PhraseData phrase)
        {
            using (var paint = new SKPaint { Color = _bgDarker, IsAntialias = true })
            {
                canvas.DrawRoundRect(rect, 5, 5, paint);
            }

            var y = rect.Top + 20;

            using (var paint = new SKPaint
            {
                Color = _textColor,
                TextSize = 14,
                IsAntialias = true,
                Typeface = _koreanFontBold
            })
            {
                canvas.DrawText($"문구 {phrase.Id} 편집", rect.Left + 10, y, paint);
            }
            y += 30;

            // 편집 필드들은 실제 입력을 위해 Windows Forms 컨트롤이 필요하지만,
            // 여기서는 표시만 함
            using (var paint = new SKPaint
            {
                Color = _textSecondary,
                TextSize = 12,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                canvas.DrawText($"텍스트: {phrase.Text}", rect.Left + 10, y, paint);
                y += 20;
                canvas.DrawText($"MP3: {(string.IsNullOrEmpty(phrase.Mp3Path) ? "없음" : Path.GetFileName(phrase.Mp3Path))}", rect.Left + 10, y, paint);
                y += 20;
                canvas.DrawText($"TTS 사용: {(phrase.UseTts ? "예" : "아니오")}", rect.Left + 10, y, paint);
            }
        }

        private void DrawServiceManagementTab(SKCanvas canvas, SKRect rect)
        {
            // 스크롤 가능한 영역
            var scrollRect = new SKRect(rect.Left, rect.Top, rect.Right, rect.Bottom);
            var contentHeight = 600f; // 전체 콘텐츠 높이
            var scrollableY = rect.Top - _settingsScrollY;

            // GroupBox 1: 서비스 관리
            var serviceGroupY = scrollableY + 10;
            var serviceGroupRect = new SKRect(rect.Left + 10, serviceGroupY, rect.Right - 10, serviceGroupY + 200);
            DrawGroupBox(canvas, serviceGroupRect, "서비스 관리");
            
            var serviceContentY = serviceGroupY + 30;
            
            // 서비스 상태 카드
            var serviceCard = new SKRect(rect.Left + 20, serviceContentY, rect.Right - 20, serviceContentY + 80);
            var isServiceRunning = CheckServiceStatus();
            DrawStatusCard(canvas, serviceCard, "윈도우 서비스 상태", isServiceRunning ? "실행 중" : "중지됨", isServiceRunning);
            serviceContentY += 100;

            // 버튼
            DrawButton(canvas, new SKRect(rect.Left + 20, serviceContentY, rect.Left + 140, serviceContentY + 35), "서비스 등록", _accentColor, () => InstallService());
            DrawButton(canvas, new SKRect(rect.Left + 150, serviceContentY, rect.Left + 270, serviceContentY + 35), "서비스 삭제", _errorColor, () => UninstallService());

            // GroupBox 2: 시리얼통신 설정
            var serialGroupY = serviceGroupY + 220;
            var serialGroupRect = new SKRect(rect.Left + 10, serialGroupY, rect.Right - 10, serialGroupY + 300);
            DrawGroupBox(canvas, serialGroupRect, "시리얼통신 설정");

            var serialContentY = serialGroupY + 30;
            DrawSerialSettings(canvas, new SKRect(rect.Left + 20, serialContentY, rect.Right - 20, serialGroupRect.Bottom - 10));
        }

        private void DrawGroupBox(SKCanvas canvas, SKRect rect, string title)
        {
            // GroupBox 배경
            using (var paint = new SKPaint { Color = _bgDarker, IsAntialias = true })
            {
                canvas.DrawRoundRect(rect, 5, 5, paint);
            }

            // GroupBox 테두리
            using (var paint = new SKPaint
            {
                Style = SKPaintStyle.Stroke,
                Color = _borderColor,
                StrokeWidth = 1,
                IsAntialias = true
            })
            {
                canvas.DrawRoundRect(rect, 5, 5, paint);
            }

            // 제목 배경 (테두리 위에)
            var titleBgRect = new SKRect(rect.Left + 15, rect.Top - 8, rect.Left + 15 + 120, rect.Top + 8);
            using (var paint = new SKPaint { Color = _bgDark, IsAntialias = true })
            {
                canvas.DrawRect(titleBgRect, paint);
            }

            // 제목 텍스트
            using (var paint = new SKPaint
            {
                Color = _textColor,
                TextSize = 14,
                IsAntialias = true,
                Typeface = _koreanFontBold
            })
            {
                canvas.DrawText(title, rect.Left + 20, rect.Top, paint);
            }
        }

        private void DrawSerialSettings(SKCanvas canvas, SKRect rect)
        {
            var y = rect.Top;
            var lineHeight = 35f;

            // COM 포트 선택
            using (var paint = new SKPaint
            {
                Color = _textSecondary,
                TextSize = 12,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                canvas.DrawText("COM 포트:", rect.Left, y, paint);
            }

            // COM 포트 표시 영역 (클릭 가능하도록)
            var comPortRect = new SKRect(rect.Left + 100, y - 15, rect.Left + 200, y + 15);
            using (var paint = new SKPaint { Color = _bgLight, IsAntialias = true })
            {
                canvas.DrawRoundRect(comPortRect, 3, 3, paint);
            }

            using (var paint = new SKPaint
            {
                Color = _textColor,
                TextSize = 12,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                var comPort = GetComPort();
                canvas.DrawText(comPort, rect.Left + 110, y, paint);
            }
            y += lineHeight;

            // 통신 속도
            using (var paint = new SKPaint
            {
                Color = _textSecondary,
                TextSize = 12,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                canvas.DrawText("통신 속도:", rect.Left, y, paint);
            }

            var baudRateRect = new SKRect(rect.Left + 100, y - 15, rect.Left + 200, y + 15);
            using (var paint = new SKPaint { Color = _bgLight, IsAntialias = true })
            {
                canvas.DrawRoundRect(baudRateRect, 3, 3, paint);
            }

            using (var paint = new SKPaint
            {
                Color = _textColor,
                TextSize = 12,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                var baudRate = GetBaudRate();
                canvas.DrawText(baudRate.ToString(), rect.Left + 110, y, paint);
            }
            y += lineHeight;

            // 자동 연결
            using (var paint = new SKPaint
            {
                Color = _textSecondary,
                TextSize = 12,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                canvas.DrawText("자동 연결:", rect.Left, y, paint);
            }

            var autoConnectRect = new SKRect(rect.Left + 100, y - 15, rect.Left + 200, y + 15);
            var isAutoConnect = GetAutoConnect();
            var autoConnectColor = isAutoConnect ? _successColor : _bgLight;
            using (var paint = new SKPaint { Color = autoConnectColor, IsAntialias = true })
            {
                canvas.DrawRoundRect(autoConnectRect, 3, 3, paint);
            }

            using (var paint = new SKPaint
            {
                Color = _textColor,
                TextSize = 12,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                canvas.DrawText(isAutoConnect ? "ON" : "OFF", rect.Left + 110, y, paint);
            }
            y += lineHeight;

            // 연결 버튼
            var connectButtonRect = new SKRect(rect.Left, y, rect.Left + 120, y + 35);
            var isConnected = _serialPortHandler?.IsConnected ?? false;
            var connectButtonColor = isConnected ? _errorColor : _accentColor;
            var connectButtonText = isConnected ? "연결 해제" : "연결";
            DrawButton(canvas, connectButtonRect, connectButtonText, connectButtonColor, () => ToggleConnection());
        }

        private int GetBaudRate()
        {
            try
            {
                return int.Parse(System.Configuration.ConfigurationManager.AppSettings["BaudRate"] ?? "9600");
            }
            catch
            {
                return 9600;
            }
        }

        private bool GetAutoConnect()
        {
            try
            {
                return bool.Parse(System.Configuration.ConfigurationManager.AppSettings["AutoConnect"] ?? "true");
            }
            catch
            {
                return true;
            }
        }

        private void ToggleConnection()
        {
            if (_serialPortHandler != null)
            {
                if (_serialPortHandler.IsConnected)
                {
                    _serialPortHandler.Disconnect();
                }
                else
                {
                    var comPort = GetComPort();
                    _serialPortHandler.Connect();
                }
                _skControl.Invalidate();
            }
        }

        private bool CheckServiceStatus()
        {
            try
            {
                var service = ServiceController.GetServices()
                    .FirstOrDefault(s => s.ServiceName == _serviceSettings.ServiceName);
                return service?.Status == ServiceControllerStatus.Running;
            }
            catch
            {
                return false;
            }
        }

        private void DrawButton(SKCanvas canvas, SKRect rect, string text, SKColor color, Action onClick)
        {
            using (var paint = new SKPaint { Color = color, IsAntialias = true })
            {
                canvas.DrawRoundRect(rect, 5, 5, paint);
            }

            using (var paint = new SKPaint
            {
                Color = _textColor,
                TextSize = 12,
                IsAntialias = true,
                Typeface = _koreanFont
            })
            {
                var textBounds = new SKRect();
                paint.MeasureText(text, ref textBounds);
                var x = rect.MidX - textBounds.Width / 2;
                var y = rect.MidY + textBounds.Height / 2;
                canvas.DrawText(text, x, y, paint);
            }
        }

        // 이벤트 핸들러들
        private void SkControl_MouseDown(object sender, MouseEventArgs e)
        {
            var appBarHeight = 50;
            var tabBarHeight = 40;
            var tabBarY = appBarHeight;
            var tabWidth = _skControl.Width / _tabNames.Length;

            if (e.Y >= tabBarY && e.Y <= tabBarY + tabBarHeight)
            {
                int clickedTab = (int)(e.X / tabWidth);
                if (clickedTab >= 0 && clickedTab < _tabNames.Length)
                {
                    _selectedTab = clickedTab;
                    _skControl.Invalidate();
                }
            }
            else
            {
                HandleContentClick(e.X, e.Y, false);
            }
        }

        private void SkControl_MouseDoubleClick(object sender, MouseEventArgs e)
        {
            var appBarHeight = 50;
            var tabBarHeight = 40;
            var contentY = appBarHeight + tabBarHeight;
            var contentRect = new SKRect(10, contentY + 10, _skControl.Width - 10, _skControl.Height - 10);
            var innerRect = new SKRect(contentRect.Left + 15, contentRect.Top + 15, contentRect.Right - 15, contentRect.Bottom - 15);
            
            if (_selectedTab == 0)
            {
                HandleStatusTabClick(e.X, e.Y, innerRect, true);
            }
            else if (_selectedTab == 1)
            {
                // 기능설정 탭 더블클릭 - 기능 항목 수정
                EditFunctionItem();
            }
        }

        private void HandleContentClick(int x, int y, bool isDoubleClick)
        {
            var appBarHeight = 50;
            var tabBarHeight = 40;
            var contentY = appBarHeight + tabBarHeight;
            var contentRect = new SKRect(10, contentY + 10, _skControl.Width - 10, _skControl.Height - 10);
            var innerRect = new SKRect(contentRect.Left + 15, contentRect.Top + 15, contentRect.Right - 15, contentRect.Bottom - 15);

            switch (_selectedTab)
            {
                case 0: HandleStatusTabClick(x, y, innerRect, isDoubleClick); break;
                case 1: HandleFunctionSettingsTabClick(x, y, innerRect); break;
                case 2: HandleBellTabClick(x, y, innerRect); break;
                case 3: HandlePhraseTabClick(x, y, innerRect); break;
                case 4: HandleServiceTabClick(x, y, innerRect); break;
            }
        }

        private void HandleStatusTabClick(int x, int y, SKRect rect, bool isDoubleClick)
        {
            // 더블클릭 처리
            if (isDoubleClick)
            {
                var clickPoint = new SKPoint(x, y);
                
                // 호출 상태 카드 더블클릭 - 벨 신호 시뮬레이션
                if (_callStatusCardRect.Contains(clickPoint))
                {
                    // 첫 번째 벨 코드로 시뮬레이션 (또는 기본 벨 코드)
                    var firstBell = _bellConfig.Bells.FirstOrDefault();
                    if (firstBell != null)
                    {
                        _service?.SimulateBellCode(firstBell.Code, "0");
                    }
                    else
                    {
                        _service?.SimulateBellCode("0d0af", "0");
                    }
                    return;
                }

                // 시리얼 통신 상태 카드 더블클릭 - 장애인 리모컨 신호 시뮬레이션
                if (_serialStatusCardRect.Contains(clickPoint))
                {
                    _service?.SimulateAssistRequest();
                    return;
                }
            }

            // 단일 클릭 - 토글 버튼 처리
            var toggleY = rect.Top + 120;
            var toggleWidth = 120f;
            var toggleHeight = 35f;
            var toggleSpacing = 15f;

            // 음성 토글
            var soundToggleRect = new SKRect(rect.Left, toggleY, rect.Left + toggleWidth, toggleY + toggleHeight);
            if (soundToggleRect.Contains(new SKPoint(x, y)))
            {
                _statusSettings.SoundEnabled = !_statusSettings.SoundEnabled;
                _statusSettings.Save();
                _skControl.Invalidate();
                return;
            }

            // 팝업 토글
            var popupToggleRect = new SKRect(rect.Left + toggleWidth + toggleSpacing, toggleY, rect.Left + toggleWidth * 2 + toggleSpacing, toggleY + toggleHeight);
            if (popupToggleRect.Contains(new SKPoint(x, y)))
            {
                _statusSettings.PopupEnabled = !_statusSettings.PopupEnabled;
                _statusSettings.Save();
                _skControl.Invalidate();
                return;
            }
        }

        private void HandleFunctionSettingsTabClick(int x, int y, SKRect rect)
        {
            var clickPoint = new SKPoint(x, y);
            
            // 기능 리스트 클릭 처리
            var listRect = new SKRect(rect.Left + 10, rect.Top + 45, rect.Right - 10, rect.Bottom - 120);
            var functions = _functionSettings.Functions.OrderBy(f => f.Id).ToList();
            var itemHeight = 35f;
            var clickedIndex = (int)((y - listRect.Top + _functionScrollY) / itemHeight);
            
            if (clickedIndex >= 0 && clickedIndex < functions.Count)
            {
                // 색상 버튼 클릭 확인
                var itemRect = new SKRect(listRect.Left, listRect.Top + clickedIndex * itemHeight - _functionScrollY, listRect.Right, listRect.Top + (clickedIndex + 1) * itemHeight - _functionScrollY);
                var colorButtonSize = 20f;
                var colorButtonRect = new SKRect(itemRect.Right - colorButtonSize - 10, itemRect.MidY - colorButtonSize / 2, itemRect.Right - 10, itemRect.MidY + colorButtonSize / 2);
                
                if (colorButtonRect.Contains(clickPoint))
                {
                    // 색상 선택 다이얼로그
                    var func = functions[clickedIndex];
                    SelectFunctionColor(func);
                    return;
                }
                
                // 항목 선택
                _selectedFunctionIndex = clickedIndex;
                var selectedFunc = functions[clickedIndex];
                _editingFunctionId = selectedFunc.Id.ToString();
                _selectedFunctionColor = SKColor.Parse(selectedFunc.Color);
                _skControl.Invalidate();
            }
            
            // 하단 버튼 클릭 처리
            var bottomY = rect.Bottom - 110;
            var buttonHeight = 30f;
            var buttonWidth = 100f;
            var buttonSpacing = 10f;
            var buttonStartX = rect.Left + 10;
            
            // TTS 버튼
            var ttsButtonRect = new SKRect(buttonStartX, bottomY, buttonStartX + buttonWidth, bottomY + buttonHeight);
            if (ttsButtonRect.Contains(clickPoint))
            {
                ToggleTts();
                return;
            }
            
            // COM 포트 버튼
            buttonStartX += buttonWidth + buttonSpacing;
            var comButtonRect = new SKRect(buttonStartX, bottomY, buttonStartX + buttonWidth, bottomY + buttonHeight);
            if (comButtonRect.Contains(clickPoint))
            {
                EditSerialPortSettings();
                return;
            }
            
            // 벨등록 버튼
            buttonStartX += buttonWidth + buttonSpacing;
            var bellAddButtonRect = new SKRect(buttonStartX, bottomY, buttonStartX + buttonWidth, bottomY + buttonHeight);
            if (bellAddButtonRect.Contains(clickPoint))
            {
                AddBellFromFunction();
                return;
            }
            
            // 벨삭제 버튼
            buttonStartX += buttonWidth + buttonSpacing;
            var bellDeleteButtonRect = new SKRect(buttonStartX, bottomY, buttonStartX + buttonWidth, bottomY + buttonHeight);
            if (bellDeleteButtonRect.Contains(clickPoint))
            {
                DeleteBellByCode();
                return;
            }
            
            // ID 입력 필드 클릭 (텍스트 입력을 위해 폼 필요)
            if (_idInputRect.Contains(clickPoint))
            {
                EditFunctionId();
            }
            
            // 기능 항목 더블클릭 시 수정
            if (clickedIndex >= 0 && clickedIndex < functions.Count)
            {
                // 더블클릭은 SkControl_MouseDoubleClick에서 처리됨
            }
        }

        private void HandleBellTabClick(int x, int y, SKRect rect)
        {
            var listRect = new SKRect(rect.Left, rect.Top + 40, rect.Right, rect.Bottom - 60);
            var itemHeight = 40f;
            var clickedIndex = (int)((y - listRect.Top + _bellScrollY) / itemHeight);
            
            if (clickedIndex >= 0 && clickedIndex < _displayBells.Count)
            {
                _selectedBellIndex = clickedIndex;
                _skControl.Invalidate();
            }

            // 버튼 클릭 처리
            var buttonY = rect.Bottom - 50;
            if (y >= buttonY && y <= buttonY + 35)
            {
                if (x >= rect.Left && x <= rect.Left + 100)
                {
                    AddBell();
                }
                else if (x >= rect.Left + 110 && x <= rect.Left + 210)
                {
                    EditBell();
                }
                else if (x >= rect.Left + 220 && x <= rect.Left + 320)
                {
                    DeleteBell();
                }
            }
        }

        private void HandlePhraseTabClick(int x, int y, SKRect rect)
        {
            var listRect = new SKRect(rect.Left, rect.Top + 40, rect.Left + rect.Width * 0.6f, rect.Bottom - 100);
            var itemHeight = 30f;
            var clickedIndex = (int)((y - listRect.Top + _phraseScrollY) / itemHeight);
            
            if (clickedIndex >= 0 && clickedIndex < _displayPhrases.Count)
            {
                _selectedPhraseIndex = clickedIndex;
                _skControl.Invalidate();
            }

            // 버튼 클릭 처리
            var buttonY = rect.Bottom - 90;
            if (y >= buttonY && y <= buttonY + 35)
            {
                if (x >= rect.Left && x <= rect.Left + 100)
                {
                    EditPhrase();
                }
                else if (x >= rect.Left + 110 && x <= rect.Left + 230)
                {
                    PlayTtsSample();
                }
                else if (x >= rect.Left + 240 && x <= rect.Left + 360)
                {
                    ShowTtsSettings();
                }
            }
        }

        private void HandleServiceTabClick(int x, int y, SKRect rect)
        {
            // 스크롤 오프셋 적용
            var scrollableY = rect.Top - _settingsScrollY;
            
            // 서비스 관리 GroupBox 영역
            var serviceGroupY = scrollableY + 10;
            var serviceGroupRect = new SKRect(rect.Left + 10, serviceGroupY, rect.Right - 10, serviceGroupY + 200);
            
            if (serviceGroupRect.Contains(new SKPoint(x, y)))
            {
                var serviceContentY = serviceGroupY + 30;
                var buttonY = serviceContentY + 100;
                
                if (y >= buttonY && y <= buttonY + 35)
                {
                    if (x >= rect.Left + 20 && x <= rect.Left + 140)
                    {
                        InstallService();
                    }
                    else if (x >= rect.Left + 150 && x <= rect.Left + 270)
                    {
                        UninstallService();
                    }
                }
            }

            // 시리얼통신 설정 GroupBox 영역
            var serialGroupY = serviceGroupY + 220;
            var serialGroupRect = new SKRect(rect.Left + 10, serialGroupY, rect.Right - 10, serialGroupY + 300);
            
            if (serialGroupRect.Contains(new SKPoint(x, y)))
            {
                var serialContentY = serialGroupY + 30;
                var lineHeight = 35f;
                
                // 연결 버튼 클릭
                var connectButtonY = serialContentY + lineHeight * 3;
                var connectButtonRect = new SKRect(rect.Left + 20, connectButtonY, rect.Left + 140, connectButtonY + 35);
                
                if (connectButtonRect.Contains(new SKPoint(x, y)))
                {
                    ToggleConnection();
                }
                
                // COM 포트, 통신 속도, 자동 연결 클릭
                var comPortY = serialContentY;
                var comPortRect = new SKRect(rect.Left + 100, comPortY - 15, rect.Left + 200, comPortY + 15);
                if (comPortRect.Contains(new SKPoint(x, y)))
                {
                    EditSerialPortSettings();
                }
                
                var baudRateY = serialContentY + lineHeight;
                var baudRateRect = new SKRect(rect.Left + 100, baudRateY - 15, rect.Left + 200, baudRateY + 15);
                if (baudRateRect.Contains(new SKPoint(x, y)))
                {
                    EditSerialPortSettings();
                }
                
                var autoConnectY = serialContentY + lineHeight * 2;
                var autoConnectRect = new SKRect(rect.Left + 100, autoConnectY - 15, rect.Left + 200, autoConnectY + 15);
                if (autoConnectRect.Contains(new SKPoint(x, y)))
                {
                    EditSerialPortSettings();
                }
            }
        }

        private void SkControl_MouseMove(object sender, MouseEventArgs e)
        {
            // 호버 효과 등
        }

        private void SkControl_MouseUp(object sender, MouseEventArgs e)
        {
            // 마우스 업 처리
        }

        private void SkControl_MouseWheel(object sender, MouseEventArgs e)
        {
            var appBarHeight = 50;
            var tabBarHeight = 40;
            var contentY = appBarHeight + tabBarHeight;
            var contentRect = new SKRect(10, contentY + 10, _skControl.Width - 10, _skControl.Height - 10);
            var innerRect = new SKRect(contentRect.Left + 15, contentRect.Top + 15, contentRect.Right - 15, contentRect.Bottom - 15);

            if (_selectedTab == 1) // 기능설정
            {
                if (e.Y > innerRect.Top + 45 && e.Y < innerRect.Bottom - 120)
                {
                    var maxFunctionScroll = Math.Max(0, _functionSettings.Functions.Count * 35f - (innerRect.Height - 165));
                    _functionScrollY = Math.Max(0, Math.Min(maxFunctionScroll, _functionScrollY - e.Delta / 120f * ScrollSpeed));
                    _skControl.Invalidate();
                }
            }
            else if (_selectedTab == 2 && e.Y > innerRect.Top + 40 && e.Y < innerRect.Bottom - 60) // 벨 설정
            {
                _bellScrollY = Math.Max(0, _bellScrollY - e.Delta / 120f * ScrollSpeed);
                _skControl.Invalidate();
            }
            else if (_selectedTab == 3 && e.Y > innerRect.Top + 40 && e.Y < innerRect.Bottom - 100) // 문구 설정
            {
                _phraseScrollY = Math.Max(0, _phraseScrollY - e.Delta / 120f * ScrollSpeed);
                _skControl.Invalidate();
            }
            else if (_selectedTab == 4) // 설정
            {
                var maxScroll = Math.Max(0, 600f - innerRect.Height);
                _settingsScrollY = Math.Max(0, Math.Min(maxScroll, _settingsScrollY - e.Delta / 120f * ScrollSpeed));
                _skControl.Invalidate();
            }
        }

        // 기능 구현 메서드들
        private void AddBell()
        {
            using (var form = new BellEditForm())
            {
                if (form.ShowDialog() == DialogResult.OK)
                {
                    var bell = new BellInfo
                    {
                        Code = form.BellCode,
                        Name = form.BellName,
                        DisplayText = form.DisplayText,
                        Color = form.Color
                    };
                    _bellConfig.AddBell(bell);
                    RefreshBellList();
                }
            }
        }

        private void EditBell()
        {
            if (_selectedBellIndex >= 0 && _selectedBellIndex < _displayBells.Count)
            {
                var bell = _displayBells[_selectedBellIndex];
                using (var form = new BellEditForm(bell))
                {
                    if (form.ShowDialog() == DialogResult.OK)
                    {
                        bell.Code = form.BellCode;
                        bell.Name = form.BellName;
                        bell.DisplayText = form.DisplayText;
                        bell.Color = form.Color;
                        _bellConfig.AddBell(bell); // AddBell은 기존 항목을 업데이트함
                        RefreshBellList();
                    }
                }
            }
            else
            {
                MessageBox.Show("수정할 벨을 선택하세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void DeleteBell()
        {
            if (_selectedBellIndex >= 0 && _selectedBellIndex < _displayBells.Count)
            {
                var bell = _displayBells[_selectedBellIndex];
                if (MessageBox.Show($"벨 '{bell.Name}'을(를) 삭제하시겠습니까?", "삭제 확인", MessageBoxButtons.YesNo) == DialogResult.Yes)
                {
                    _bellConfig.RemoveBell(bell.Code);
                    RefreshBellList();
                    _selectedBellIndex = -1;
                }
            }
            else
            {
                MessageBox.Show("삭제할 벨을 선택하세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void EditPhrase()
        {
            if (_selectedPhraseIndex >= 0 && _selectedPhraseIndex < _displayPhrases.Count)
            {
                var phrase = _displayPhrases[_selectedPhraseIndex];
                using (var form = new PhraseEditForm(phrase))
                {
                    if (form.ShowDialog() == DialogResult.OK)
                    {
                        _phrasesConfig.UpdatePhrase(phrase.Id, form.PhraseText, form.Mp3Path, form.UseTts);
                        RefreshPhraseList();
                    }
                }
            }
            else
            {
                MessageBox.Show("편집할 문구를 선택하세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void ToggleTts()
        {
            _ttsSettings.Enabled = !_ttsSettings.Enabled;
            _ttsSettings.Save();
            _skControl.Invalidate();
        }

        private void AddBellFromFunction()
        {
            if (_selectedFunctionIndex >= 0)
            {
                var functions = _functionSettings.Functions.OrderBy(f => f.Id).ToList();
                if (_selectedFunctionIndex < functions.Count)
                {
                    var func = functions[_selectedFunctionIndex];
                    
                    // 벨 코드 입력 다이얼로그
                    using (var inputForm = new Form())
                    {
                        inputForm.Text = "벨 등록";
                        inputForm.Size = new Size(450, 220);
                        inputForm.StartPosition = FormStartPosition.CenterParent;
                        inputForm.FormBorderStyle = FormBorderStyle.FixedDialog;
                        inputForm.MaximizeBox = false;
                        inputForm.MinimizeBox = false;
                        
                        var label1 = new Label { Text = "벨 코드:", Location = new Point(10, 15), AutoSize = true };
                        var txtCode = new TextBox { Location = new Point(10, 35), Width = 410 };
                        var label2 = new Label { Text = "벨 이름:", Location = new Point(10, 65), AutoSize = true };
                        var txtName = new TextBox { Text = func.Text, Location = new Point(10, 85), Width = 410 };
                        var okButton = new Button { Text = "등록", DialogResult = DialogResult.OK, Location = new Point(270, 150), Width = 70 };
                        var cancelButton = new Button { Text = "취소", DialogResult = DialogResult.Cancel, Location = new Point(350, 150), Width = 70 };
                        
                        inputForm.Controls.Add(label1);
                        inputForm.Controls.Add(txtCode);
                        inputForm.Controls.Add(label2);
                        inputForm.Controls.Add(txtName);
                        inputForm.Controls.Add(okButton);
                        inputForm.Controls.Add(cancelButton);
                        inputForm.AcceptButton = okButton;
                        inputForm.CancelButton = cancelButton;
                        
                        if (inputForm.ShowDialog() == DialogResult.OK)
                        {
                            if (string.IsNullOrWhiteSpace(txtCode.Text))
                            {
                                MessageBox.Show("벨 코드를 입력하세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                                return;
                            }
                            
                            var bell = new BellInfo
                            {
                                Code = txtCode.Text.Trim(),
                                Name = string.IsNullOrWhiteSpace(txtName.Text) ? func.Text : txtName.Text.Trim(),
                                DisplayText = func.Text,
                                Color = func.Color
                            };
                            
                            _bellConfig.AddBell(bell);
                            RefreshBellList();
                            MessageBox.Show("벨이 등록되었습니다.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }
                    }
                }
            }
            else
            {
                MessageBox.Show("등록할 기능을 선택하세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void DeleteBellByCode()
        {
            if (!string.IsNullOrEmpty(_editingFunctionId))
            {
                // ID 필드에 벨 코드가 입력되어 있다고 가정
                var bellCode = _editingFunctionId.Trim();
                
                if (string.IsNullOrWhiteSpace(bellCode))
                {
                    MessageBox.Show("벨 코드를 입력하세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                
                var bell = _bellConfig.FindBellByCode(bellCode);
                if (bell != null)
                {
                    if (MessageBox.Show($"벨 '{bell.Name}' (코드: {bell.Code})을(를) 삭제하시겠습니까?", "삭제 확인", MessageBoxButtons.YesNo) == DialogResult.Yes)
                    {
                        _bellConfig.RemoveBell(bellCode);
                        RefreshBellList();
                        MessageBox.Show("벨이 삭제되었습니다.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                }
                else
                {
                    MessageBox.Show($"벨 코드 '{bellCode}'를 찾을 수 없습니다.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }
            else
            {
                MessageBox.Show("벨 코드를 입력하세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void SelectFunctionColor(FunctionItem func)
        {
            using (var colorDialog = new ColorDialog())
            {
                var currentColor = ColorTranslator.FromHtml(func.Color);
                colorDialog.Color = currentColor;
                colorDialog.FullOpen = true;
                
                if (colorDialog.ShowDialog() == DialogResult.OK)
                {
                    var colorHex = $"#{colorDialog.Color.R:X2}{colorDialog.Color.G:X2}{colorDialog.Color.B:X2}";
                    _functionSettings.UpdateFunction(func.Id, color: colorHex);
                    _selectedFunctionColor = SKColor.Parse(colorHex);
                    RefreshFunctionList();
                }
            }
        }

        private void EditFunctionId()
        {
            // ID 입력을 위한 간단한 입력 다이얼로그
            using (var inputForm = new Form())
            {
                inputForm.Text = "ID 입력";
                inputForm.Size = new Size(400, 150);
                inputForm.StartPosition = FormStartPosition.CenterParent;
                inputForm.FormBorderStyle = FormBorderStyle.FixedDialog;
                inputForm.MaximizeBox = false;
                inputForm.MinimizeBox = false;
                
                var label = new Label { Text = "ID를 입력하세요:", Location = new Point(10, 15), AutoSize = true };
                var textBox = new TextBox { Text = _editingFunctionId, Location = new Point(10, 35), Width = 360 };
                var okButton = new Button { Text = "확인", DialogResult = DialogResult.OK, Location = new Point(220, 80), Width = 70 };
                var cancelButton = new Button { Text = "취소", DialogResult = DialogResult.Cancel, Location = new Point(300, 80), Width = 70 };
                
                inputForm.Controls.Add(label);
                inputForm.Controls.Add(textBox);
                inputForm.Controls.Add(okButton);
                inputForm.Controls.Add(cancelButton);
                inputForm.AcceptButton = okButton;
                inputForm.CancelButton = cancelButton;
                
                if (inputForm.ShowDialog() == DialogResult.OK && !string.IsNullOrEmpty(textBox.Text))
                {
                    _editingFunctionId = textBox.Text;
                    if (int.TryParse(textBox.Text, out int id))
                    {
                        var func = _functionSettings.GetFunction(id);
                        if (func != null)
                        {
                            _selectedFunctionIndex = _functionSettings.Functions.OrderBy(f => f.Id).ToList().IndexOf(func);
                            _selectedFunctionColor = SKColor.Parse(func.Color);
                        }
                    }
                    _skControl.Invalidate();
                }
            }
        }

        private void EditFunctionItem()
        {
            if (_selectedFunctionIndex >= 0)
            {
                var functions = _functionSettings.Functions.OrderBy(f => f.Id).ToList();
                if (_selectedFunctionIndex < functions.Count)
                {
                    var func = functions[_selectedFunctionIndex];
                    
                    // 기능 항목 수정 다이얼로그
                    using (var editForm = new Form())
                    {
                        editForm.Text = "기능 수정";
                        editForm.Size = new Size(500, 350);
                        editForm.StartPosition = FormStartPosition.CenterParent;
                        editForm.FormBorderStyle = FormBorderStyle.FixedDialog;
                        editForm.MaximizeBox = false;
                        editForm.MinimizeBox = false;
                        
                        var label1 = new Label { Text = "ID:", Location = new Point(10, 15), AutoSize = true };
                        var txtId = new TextBox { Text = func.Id.ToString(), Location = new Point(10, 35), Width = 460, ReadOnly = true, BackColor = SystemColors.Control };
                        var label2 = new Label { Text = "텍스트:", Location = new Point(10, 65), AutoSize = true };
                        var txtText = new TextBox { Text = func.Text, Location = new Point(10, 85), Width = 460, Height = 100, Multiline = true, ScrollBars = ScrollBars.Vertical };
                        var label3 = new Label { Text = "색상:", Location = new Point(10, 195), AutoSize = true };
                        var btnColor = new Button { Text = "색상 선택", Location = new Point(10, 215), Width = 100, Height = 30 };
                        var colorPreview = new Panel { Location = new Point(120, 215), Size = new Size(80, 30), BorderStyle = BorderStyle.FixedSingle };
                        var currentColor = ColorTranslator.FromHtml(func.Color);
                        colorPreview.BackColor = currentColor;
                        
                        var okButton = new Button { Text = "저장", DialogResult = DialogResult.OK, Location = new Point(330, 280), Width = 70, Height = 30 };
                        var cancelButton = new Button { Text = "취소", DialogResult = DialogResult.Cancel, Location = new Point(410, 280), Width = 70, Height = 30 };
                        
                        Color selectedColor = currentColor;
                        btnColor.Click += (s, e) =>
                        {
                            using (var colorDialog = new ColorDialog())
                            {
                                colorDialog.Color = selectedColor;
                                colorDialog.FullOpen = true;
                                if (colorDialog.ShowDialog() == DialogResult.OK)
                                {
                                    selectedColor = colorDialog.Color;
                                    colorPreview.BackColor = selectedColor;
                                }
                            }
                        };
                        
                        editForm.Controls.Add(label1);
                        editForm.Controls.Add(txtId);
                        editForm.Controls.Add(label2);
                        editForm.Controls.Add(txtText);
                        editForm.Controls.Add(label3);
                        editForm.Controls.Add(btnColor);
                        editForm.Controls.Add(colorPreview);
                        editForm.Controls.Add(okButton);
                        editForm.Controls.Add(cancelButton);
                        editForm.AcceptButton = okButton;
                        editForm.CancelButton = cancelButton;
                        
                        if (editForm.ShowDialog() == DialogResult.OK)
                        {
                            if (string.IsNullOrWhiteSpace(txtText.Text))
                            {
                                MessageBox.Show("텍스트를 입력하세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                                return;
                            }
                            
                            var colorHex = $"#{selectedColor.R:X2}{selectedColor.G:X2}{selectedColor.B:X2}";
                            _functionSettings.UpdateFunction(func.Id, txtText.Text.Trim(), colorHex);
                            RefreshFunctionList();
                            _skControl.Invalidate();
                            MessageBox.Show("기능이 수정되었습니다.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }
                    }
                }
            }
            else
            {
                MessageBox.Show("수정할 기능을 선택하세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void EditSerialPortSettings()
        {
            var currentComPort = GetComPort();
            var currentBaudRate = GetBaudRate();
            var autoConnect = GetAutoConnect();
            
            using (var form = new SerialPortSettingsForm(currentComPort, currentBaudRate, autoConnect))
            {
                if (form.ShowDialog() == DialogResult.OK)
                {
                    // app.config에 저장
                    var config = System.Configuration.ConfigurationManager.OpenExeConfiguration(System.Configuration.ConfigurationUserLevel.None);
                    config.AppSettings.Settings["ComPort"].Value = form.ComPort;
                    config.AppSettings.Settings["BaudRate"].Value = form.BaudRate.ToString();
                    config.AppSettings.Settings["AutoConnect"].Value = form.AutoConnect.ToString();
                    config.Save(System.Configuration.ConfigurationSaveMode.Modified);
                    System.Configuration.ConfigurationManager.RefreshSection("appSettings");
                    
                    // 시리얼 포트 재연결
                    if (_service != null && _service.SerialPortHandler != null)
                    {
                        _service.SerialPortHandler.Disconnect();
                        _service.SerialPortHandler.Dispose();
                    }
                    
                    if (form.AutoConnect && _service != null)
                    {
                        // 서비스의 SerialPortHandler 업데이트
                        var newHandler = new SerialPortHandler(form.ComPort, form.BaudRate);
                        newHandler.DataReceived += (s, data) => _service?.OnDataReceived(s, data);
                        newHandler.ConnectionStatusChanged += (s, connected) => 
                        {
                            System.Diagnostics.Debug.WriteLine($"연결 상태 변경: {(connected ? "연결됨" : "연결 해제됨")}");
                        };
                        
                        // 서비스의 SerialPortHandler 업데이트 (리플렉션 사용)
                        var serviceType = _service.GetType();
                        var handlerField = serviceType.GetField("_serialPortHandler", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                        if (handlerField != null)
                        {
                            handlerField.SetValue(_service, newHandler);
                        }
                        
                        _serialPortHandler = newHandler;
                        newHandler.Connect();
                    }
                    
                    _skControl.Invalidate();
                    MessageBox.Show("시리얼 포트 설정이 저장되었습니다.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
        }

        private void PlayTtsSample()
        {
            if (_selectedPhraseIndex >= 0 && _selectedPhraseIndex < _displayPhrases.Count)
            {
                var phrase = _displayPhrases[_selectedPhraseIndex];
                if (phrase.UseTts)
                {
                    _ttsManager?.Speak(phrase.Text);
                }
                else if (!string.IsNullOrEmpty(phrase.Mp3Path) && File.Exists(phrase.Mp3Path))
                {
                    _ttsManager?.PlayMp3Async(phrase.Mp3Path);
                }
            }
        }

        private void ShowTtsSettings()
        {
            using (var form = new TtsSettingsForm(_ttsSettings, _ttsManager))
            {
                if (form.ShowDialog() == DialogResult.OK)
                {
                    _ttsSettings = form.Settings;
                    _ttsSettings.Save();
                    _ttsManager?.ReloadSettings();
                }
            }
        }

        private void InstallService()
        {
            MessageBox.Show("서비스 등록 기능은 추후 구현 예정입니다.", "알림", MessageBoxButtons.OK);
        }

        private void UninstallService()
        {
            if (MessageBox.Show("서비스를 삭제하시겠습니까?", "삭제 확인", MessageBoxButtons.YesNo) == DialogResult.Yes)
            {
                MessageBox.Show("서비스 삭제 기능은 추후 구현 예정입니다.", "알림", MessageBoxButtons.OK);
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                this.Hide();
            }
            base.OnFormClosing(e);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _animationTimer?.Stop();
                _animationTimer?.Dispose();
                _updateTimer?.Stop();
                _updateTimer?.Dispose();
                _ttsManager?.Dispose();
                _skControl?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
