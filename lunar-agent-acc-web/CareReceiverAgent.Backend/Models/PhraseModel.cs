using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace CareReceiverAgent.Backend.Models
{
    /// <summary>
    /// 알림 문구 데이터 모델
    /// </summary>
    public class PhraseModel : INotifyPropertyChanged
    {
        private int _id;
        private string _text = string.Empty;
        private bool _isEnabled = true;
        private string _color = "#FF0000";
        private List<string> _bellCodes = new List<string>();
        private DateTime _createdAt = DateTime.Now;
        private DateTime _updatedAt = DateTime.Now;

        public event PropertyChangedEventHandler? PropertyChanged;

        protected void RaisePropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

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
    }

    /// <summary>
    /// 문구 설정 데이터베이스
    /// </summary>
    public class PhraseDatabase
    {
        public List<PhraseModel> Phrases { get; set; } = new List<PhraseModel>();
        private int _nextId = 1;

        public PhraseDatabase()
        {
            // 기본 문구 추가
            Phrases.Add(new PhraseModel
            {
                Id = _nextId++,
                Text = "출입구에서 도움을 요청합니다.",
                IsEnabled = true,
                Color = "#FF0000",
                BellCodes = new List<string>()
            });
        }
    }

    public class SerialSettings
    {
        public string PortName { get; set; } = "COM1";
        public int BaudRate { get; set; } = 9600;
        public bool AutoConnect { get; set; } = true;
    }
}

