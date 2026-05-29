using System;
using System.Collections.Generic;
using CareReceiverAgent.Host.Models;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// QA 검수용 기본 데이터 시드. 실행 시 필백으로 유저ID/매장ID/호출벨 5개·문구 등 기초 정보를 채움.
    /// </summary>
    public static class QaSeedService
    {
        private const string DefaultBellCode = "crcv.assist";
        private const string DefaultUid = "90000001";
        private static readonly string[] QaBellCodes = { DefaultBellCode, "qa.1", "qa.2", "qa.3", "qa.4" };
        private static readonly string[] QaTexts = { "도와주세요.", "QA 호출 1", "QA 호출 2", "QA 호출 3", "QA 호출 4" };
        private static readonly string[] QaColors = { "#FF0000", "#0066CC", "#00AA00", "#CC6600", "#6600CC" };

        /// <summary>
        /// QA 모드이고 문구가 비었거나 5개 미만이면 호출벨 5개(문구 5개) 시드. 유저ID/매장ID는 app.json에서 로드.
        /// </summary>
        public static void EnsureQaSeedIfNeeded()
        {
            var cfg = AppRuntimeConfig.Load();
            if (!cfg.QaEnabled)
                return;

            var db = JsonDatabaseService.LoadPhrases();
            if (db.Phrases.Count >= 5)
                return;

            // 기존 기본 문구 유지하고, QA용 5개로 맞춤
            var list = new List<PhraseModel>();
            for (int i = 0; i < QaBellCodes.Length; i++)
            {
                var uid = i == 0 ? DefaultUid : Guid.NewGuid().ToString();
                list.Add(new PhraseModel
                {
                    Uid = uid,
                    Text = QaTexts[i],
                    IsEnabled = true,
                    Color = QaColors[i],
                    BellCodes = new List<string> { QaBellCodes[i] },
                    AutoCloseEnabled = false,
                    AutoCloseSeconds = 10,
                    ImageUrl = null,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                });
            }

            db.Phrases.Clear();
            db.Phrases.AddRange(list);
            JsonDatabaseService.SavePhrases(db);
            System.Diagnostics.Debug.WriteLine($"QA 시드 완료: 유저={cfg.QaUserId}, 매장={cfg.QaStoreId}, 호출벨 5개 등록");
        }
    }
}
