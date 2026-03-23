using System.Text.RegularExpressions;

namespace CareReceiverAgent.Host.Services
{
    public static class PhraseImageStorage
    {
        public static string BaseDir => Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "data", "phrase_images");

        public static void EnsureDir()
        {
            if (!Directory.Exists(BaseDir))
            {
                Directory.CreateDirectory(BaseDir);
            }
        }

        public static string SanitizeUid(string uid)
        {
            uid ??= string.Empty;
            uid = uid.Trim();
            // 파일 경로 안전을 위해 허용 문자만 남김
            uid = Regex.Replace(uid, @"[^a-zA-Z0-9\-_]", "_");
            return uid;
        }

        public static string GetPhraseDir(string uid)
        {
            EnsureDir();
            return Path.Combine(BaseDir, SanitizeUid(uid));
        }

        public static string GetMediaUrl(string relativePathFromBaseDir)
        {
            // BaseDir가 /media로 매핑됨
            var rel = relativePathFromBaseDir.Replace('\\', '/').TrimStart('/');
            return "/media/" + rel;
        }
    }
}

