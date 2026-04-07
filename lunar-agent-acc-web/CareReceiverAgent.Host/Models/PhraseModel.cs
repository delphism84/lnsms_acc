using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Text.Json.Serialization;

namespace CareReceiverAgent.Host.Models
{
    /// <summary>
    /// ?�림 문구 ?�이??모델
    /// </summary>
    public class PhraseModel : INotifyPropertyChanged
    {
        private int _id;
        private string _uid = Guid.NewGuid().ToString();
        private string _text = string.Empty;
        private bool _isEnabled = true;
        private string _color = "#FF0000";
        private List<string> _bellCodes = new List<string>();
        private bool _autoCloseEnabled = false;
        private int _autoCloseSeconds = 10;
        private string? _imageUrl = null;
        private DateTime _createdAt = DateTime.Now;
        private DateTime _updatedAt = DateTime.Now;

        public event PropertyChangedEventHandler? PropertyChanged;

        protected void RaisePropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

        [System.Text.Json.Serialization.JsonIgnore]
        public int Id
        {
            get => _id;
            set
            {
                if (_id != value)
                {
                    _id = value;
                    RaisePropertyChanged();
                }
            }
        }

        public string Uid
        {
            get => _uid;
            set
            {
                if (_uid != value)
                {
                    _uid = string.IsNullOrEmpty(value) ? Guid.NewGuid().ToString() : value;
                    RaisePropertyChanged();
                }
            }
        }

        public string Text
        {
            get => _text;
            set
            {
                if (_text != value)
                {
                    _text = value;
                    RaisePropertyChanged();
                }
            }
        }

        public bool IsEnabled
        {
            get => _isEnabled;
            set
            {
                if (_isEnabled != value)
                {
                    _isEnabled = value;
                    RaisePropertyChanged();
                }
            }
        }

        public string Color
        {
            get => _color;
            set
            {
                if (_color != value)
                {
                    _color = value;
                    RaisePropertyChanged();
                }
            }
        }

        public List<string> BellCodes
        {
            get => _bellCodes;
            set
            {
                if (_bellCodes != value)
                {
                    _bellCodes = value ?? new List<string>();
                    RaisePropertyChanged();
                    RaisePropertyChanged(nameof(BellCount));
                }
            }
        }

        public void NotifyBellCodesChanged()
        {
            RaisePropertyChanged(nameof(BellCodes));
            RaisePropertyChanged(nameof(BellCount));
        }

        public DateTime CreatedAt
        {
            get => _createdAt;
            set
            {
                if (_createdAt != value)
                {
                    _createdAt = value;
                    RaisePropertyChanged();
                }
            }
        }

        public DateTime UpdatedAt
        {
            get => _updatedAt;
            set
            {
                if (_updatedAt != value)
                {
                    _updatedAt = value;
                    RaisePropertyChanged();
                }
            }
        }

        public int BellCount => BellCodes?.Count ?? 0;

        // 문구별 자동꺼짐
        public bool AutoCloseEnabled
        {
            get => _autoCloseEnabled;
            set
            {
                if (_autoCloseEnabled != value)
                {
                    _autoCloseEnabled = value;
                    RaisePropertyChanged();
                }
            }
        }

        public int AutoCloseSeconds
        {
            get => _autoCloseSeconds;
            set
            {
                var v = value;
                if (v < 1) v = 1;
                if (v > 3600) v = 3600;
                if (_autoCloseSeconds != v)
                {
                    _autoCloseSeconds = v;
                    RaisePropertyChanged();
                }
            }
        }

        // 문구별 이미지 URL (예: "/images/xxx.png")
        public string? ImageUrl
        {
            get => _imageUrl;
            set
            {
                if (_imageUrl != value)
                {
                    _imageUrl = value;
                    RaisePropertyChanged();
                }
            }
        }

        /// <summary>호출벨 회사(메이커) ID. 추후 BE에서 관리, 현재는 기본 필백 목록 사용.</summary>
        public string? MakerId { get; set; }
        /// <summary>호출벨 모델 ID.</summary>
        public string? ModelId { get; set; }
    }

    /// <summary>
    /// 문구 ?�정 ?�이?�베?�스
    /// </summary>
    public class PhraseDatabase
    {
        public List<PhraseModel> Phrases { get; set; } = new List<PhraseModel>();

        public PhraseDatabase()
        {
            // 기본 문구는 LoadPhrases에서 추가됨
        }
    }

    /// <summary>
    /// 등록된 시리얼 포트 1개 항목 (다중 포트 지원)
    /// </summary>
    public class SerialPortEntry
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string PortName { get; set; } = "COM1";
        public int BaudRate { get; set; } = 9600;
        public bool AutoConnect { get; set; } = true;
        public bool SecureEnabled { get; set; } = false;
        /// <summary>
        /// 세션 시드로 v4 복호화가 실패해도, 알려진 레거시 시드(예: 0x1234)로 <c>bell=</c> 프레임만 복호화를 재시도합니다.
        /// <c>null</c>: 구 설정 파일(필드 없음) — <see cref="SecureEnabled"/>가 true이면 연결 시 레거시 시도로 간주합니다.
        /// </summary>
        public bool? AllowLegacyBellDecrypt { get; set; }
        /// <summary>
        /// UART 프로토콜 v4: 8자리 시리얼(prefix). 모를 경우 "00000000"로 통신 체크를 보냄.
        /// </summary>
        public string DeviceSerialNumber { get; set; } = "00000000";
    }

    /// <summary>
    /// 시리얼 포트 설정 (다중 포트 목록)
    /// </summary>
    public class SerialSettings
    {
        public List<SerialPortEntry> Ports { get; set; } = new List<SerialPortEntry>();
    }
}

