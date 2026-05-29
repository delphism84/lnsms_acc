using System;
using System.Collections.Generic;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// 수신 바이트를 누적하고, <c>\r</c>로 끝나는 완성 줄만 앞에서 잘라 추출합니다.
    /// 소비한 바이트는 버퍼에서 제거되어 남는 것은 미완성 꼬리뿐입니다.
    /// </summary>
    internal static class CrDelimitedRxBuffer
    {
        /// <summary>\r 없이 누적만 이 크기를 넘으면 선행을 잘라냅니다.</summary>
        public const int MaxPendingWithoutCr = 4096;

        /// <summary>과다 시 앞부분을 버리고 이 길이만 꼬리로 유지합니다.</summary>
        public const int KeepTailBytes = 2048;

        public static void Append(List<byte> buffer, ReadOnlySpan<byte> data)
        {
            for (var i = 0; i < data.Length; i++)
                buffer.Add(data[i]);
        }

        /// <summary>완성된 한 줄(<c>\r</c> 포함 소비)이 있으면 본문만 반환하고 버퍼 앞을 제거합니다.</summary>
        public static bool TryExtractOneLine(List<byte> buffer, out byte[] lineWithoutCr)
        {
            lineWithoutCr = Array.Empty<byte>();
            var cr = buffer.IndexOf((byte)0x0d);
            if (cr < 0) return false;

            lineWithoutCr = cr == 0 ? Array.Empty<byte>() : new byte[cr];
            if (cr > 0)
                buffer.CopyTo(0, lineWithoutCr, 0, cr);

            buffer.RemoveRange(0, cr + 1);
            while (buffer.Count > 0 && buffer[0] == 0x0a)
                buffer.RemoveAt(0);

            return true;
        }

        /// <summary>버퍼 앞에서부터 <c>\r</c> 완성 줄을 반복 추출합니다.</summary>
        public static void ExtractAllCompleteLines(List<byte> buffer, Action<byte[]> emitLineWithoutCr)
        {
            while (TryExtractOneLine(buffer, out var line))
                emitLineWithoutCr(line);
        }

        /// <summary>
        /// <c>\r</c> 없이만 길이가 <see cref="MaxPendingWithoutCr"/>를 넘으면 앞쪽을 잘라
        /// 최근 <see cref="KeepTailBytes"/>만 남깁니다(동기 깨짐 시에도 꼬리 프레임 보존).
        /// </summary>
        public static void TrimOverflowWithoutCr(List<byte> buffer, Action<int, int>? onTrim = null)
        {
            if (buffer.Count <= MaxPendingWithoutCr)
                return;

            var cr = buffer.IndexOf((byte)0x0d);
            if (cr >= 0)
                return;

            var drop = buffer.Count - KeepTailBytes;
            if (drop <= 0)
                return;

            buffer.RemoveRange(0, drop);
            onTrim?.Invoke(drop, buffer.Count);
        }
    }
}
