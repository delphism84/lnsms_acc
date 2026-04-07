using System;
using System.Collections.Generic;
using System.Linq;
using CareReceiverAgent.Host.Models;
using MongoDB.Driver;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// MongoDB 기반 데이터 저장. JSON/document 형태로 phrases, serial_settings 저장.
    /// </summary>
    public static class MongoDatabaseService
    {
        private const string PhrasesCollectionName = "phrases";
        private const string SerialSettingsCollectionName = "serial_settings";
        private const string DocId = "db";
        private const string SerialDocId = "serial";

        public static PhraseDatabase LoadPhrases(string connectionString, string databaseName)
        {
            var client = new MongoClient(connectionString);
            var db = client.GetDatabase(string.IsNullOrWhiteSpace(databaseName) ? "agent" : databaseName);
            var coll = db.GetCollection<PhraseDatabaseDoc>(PhrasesCollectionName);

            var doc = coll.Find(Builders<PhraseDatabaseDoc>.Filter.Eq(x => x.Id, DocId)).FirstOrDefault();
            if (doc == null)
                return new PhraseDatabase();

            var phraseDb = new PhraseDatabase();
            phraseDb.Phrases = doc.Phrases?.Select(ToPhraseModel).ToList() ?? new List<PhraseModel>();
            return phraseDb;
        }

        public static void SavePhrases(string connectionString, string databaseName, PhraseDatabase database)
        {
            if (database == null) return;

            var client = new MongoClient(connectionString);
            var db = client.GetDatabase(string.IsNullOrWhiteSpace(databaseName) ? "agent" : databaseName);
            var coll = db.GetCollection<PhraseDatabaseDoc>(PhrasesCollectionName);

            var doc = new PhraseDatabaseDoc
            {
                Id = DocId,
                Phrases = database.Phrases?.Select(ToPhraseDoc).ToList() ?? new List<PhraseDoc>()
            };

            coll.ReplaceOne(
                Builders<PhraseDatabaseDoc>.Filter.Eq(x => x.Id, DocId),
                doc,
                new ReplaceOptions { IsUpsert = true });
        }

        public static SerialSettings LoadSerialSettings(string connectionString, string databaseName)
        {
            var client = new MongoClient(connectionString);
            var db = client.GetDatabase(string.IsNullOrWhiteSpace(databaseName) ? "agent" : databaseName);
            var coll = db.GetCollection<SerialSettingsDoc>(SerialSettingsCollectionName);

            var doc = coll.Find(Builders<SerialSettingsDoc>.Filter.Eq(x => x.Id, SerialDocId)).FirstOrDefault();
            if (doc == null || doc.Ports == null || doc.Ports.Count == 0)
                return new SerialSettings();

            var ports = doc.Ports.Select(p => new SerialPortEntry
            {
                Id = p.Id ?? Guid.NewGuid().ToString("N"),
                PortName = p.PortName ?? "COM1",
                BaudRate = p.BaudRate,
                AutoConnect = p.AutoConnect,
                SecureEnabled = p.SecureEnabled,
                AllowLegacyBellDecrypt = p.AllowLegacyBellDecrypt,
                DeviceSerialNumber = p.DeviceSerialNumber ?? "00000000"
            }).ToList();
            return new SerialSettings { Ports = ports };
        }

        public static void SaveSerialSettings(string connectionString, string databaseName, SerialSettings settings)
        {
            if (settings == null) return;

            var client = new MongoClient(connectionString);
            var db = client.GetDatabase(string.IsNullOrWhiteSpace(databaseName) ? "agent" : databaseName);
            var coll = db.GetCollection<SerialSettingsDoc>(SerialSettingsCollectionName);

            var ports = (settings.Ports ?? new List<SerialPortEntry>()).Select(p => new SerialPortEntryDoc
            {
                Id = p.Id ?? Guid.NewGuid().ToString("N"),
                PortName = p.PortName ?? "COM1",
                BaudRate = p.BaudRate,
                AutoConnect = p.AutoConnect,
                SecureEnabled = p.SecureEnabled,
                AllowLegacyBellDecrypt = p.AllowLegacyBellDecrypt,
                DeviceSerialNumber = p.DeviceSerialNumber ?? "00000000"
            }).ToList();

            var doc = new SerialSettingsDoc { Id = SerialDocId, Ports = ports };

            coll.ReplaceOne(
                Builders<SerialSettingsDoc>.Filter.Eq(x => x.Id, SerialDocId),
                doc,
                new ReplaceOptions { IsUpsert = true });
        }

        private static PhraseDoc ToPhraseDoc(PhraseModel p)
        {
            return new PhraseDoc
            {
                Uid = p.Uid ?? string.Empty,
                Text = p.Text ?? string.Empty,
                IsEnabled = p.IsEnabled,
                Color = p.Color ?? "#FF0000",
                BellCodes = p.BellCodes?.ToList() ?? new List<string>(),
                AutoCloseEnabled = p.AutoCloseEnabled,
                AutoCloseSeconds = p.AutoCloseSeconds,
                ImageUrl = p.ImageUrl,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                MakerId = p.MakerId,
                ModelId = p.ModelId
            };
        }

        private static PhraseModel ToPhraseModel(PhraseDoc d)
        {
            return new PhraseModel
            {
                Uid = d.Uid ?? Guid.NewGuid().ToString(),
                Text = d.Text ?? string.Empty,
                IsEnabled = d.IsEnabled,
                Color = d.Color ?? "#FF0000",
                BellCodes = d.BellCodes ?? new List<string>(),
                AutoCloseEnabled = d.AutoCloseEnabled,
                AutoCloseSeconds = d.AutoCloseSeconds,
                ImageUrl = d.ImageUrl,
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt,
                MakerId = d.MakerId,
                ModelId = d.ModelId
            };
        }
    }
}
