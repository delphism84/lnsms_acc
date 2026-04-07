using System;
using System.Collections.Generic;
using MongoDB.Bson.Serialization.Attributes;

namespace CareReceiverAgent.Host.Models
{
    /// <summary>
    /// MongoDB에 저장하는 문구 문서 (POCO, 기존 PhraseModel과 동일 구조)
    /// </summary>
    public class PhraseDoc
    {
        public string Uid { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public bool IsEnabled { get; set; } = true;
        public string Color { get; set; } = "#FF0000";
        public List<string> BellCodes { get; set; } = new List<string>();
        public bool AutoCloseEnabled { get; set; }
        public int AutoCloseSeconds { get; set; } = 10;
        public string? ImageUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string? MakerId { get; set; }
        public string? ModelId { get; set; }
    }

    /// <summary>
    /// phrases 컬렉션 1개 문서 (문구 목록 전체)
    /// </summary>
    public class PhraseDatabaseDoc
    {
        [BsonId]
        public string Id { get; set; } = "db";

        [BsonElement("phrases")]
        public List<PhraseDoc> Phrases { get; set; } = new List<PhraseDoc>();
    }

    /// <summary>
    /// serial_settings 컬렉션 1개 문서 (다중 포트)
    /// </summary>
    public class SerialSettingsDoc
    {
        [BsonId]
        public string Id { get; set; } = "serial";

        [BsonElement("ports")]
        public List<SerialPortEntryDoc> Ports { get; set; } = new List<SerialPortEntryDoc>();
    }

    public class SerialPortEntryDoc
    {
        public string? Id { get; set; }
        public string? PortName { get; set; } = "COM1";
        public int BaudRate { get; set; } = 9600;
        public bool AutoConnect { get; set; } = true;
        public bool SecureEnabled { get; set; }
        public bool? AllowLegacyBellDecrypt { get; set; }
        public string DeviceSerialNumber { get; set; } = "00000000";
    }
}
