using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// docs/secure_fw.c 기반 시드/난독화/CRC 코덱.
    /// - 프레이밍: "&lt;prefix&gt;." 접두는 평문 유지, 이후 32-hex(16바이트) 페이로드만 인코딩/디코딩
    /// - 평문 입력: 최대 15바이트, 부족분은 0x00 패딩
    /// </summary>
    public static class SecureSerialCodec
    {
        private const byte BaseRandChar = 0x20; // ' '

        public static ushort GenerateSessionSeed()
        {
            Span<byte> b = stackalloc byte[2];
            RandomNumberGenerator.Fill(b);
            return (ushort)(b[0] | (b[1] << 8));
        }

        /// <summary>
        /// PC -> 모듈: crcv.seed=&lt;44 chars&gt;
        /// (secure_fw.c: make_sync_str)
        /// </summary>
        public static string MakeSeedMarkString(ushort sessionSeed)
        {
            // 44 chars: [0..1]=loc32, [2..33]=hidden_patt(32), [34..35]=loc10, [36..43]=margin
            var rng = RandomNumberGenerator.Create();
            byte Next32()
            {
                Span<byte> bb = stackalloc byte[1];
                rng.GetBytes(bb);
                return (byte)(bb[0] & 0x1f);
            }

            byte[] loc = new byte[4];
            for (int i = 0; i < 4; i++)
            {
                byte v = Next32();
                // 중복 제거 (레퍼런스의 약식 로직을 안전하게 재현)
                bool dup;
                do
                {
                    dup = false;
                    for (int j = 0; j < i; j++)
                    {
                        if (loc[j] == v)
                        {
                            v = (byte)((v + 1) & 0x1f);
                            dup = true;
                        }
                    }
                } while (dup);
                loc[i] = v;
            }

            char[] s = new char[44];
            for (int i = 0; i < 44; i++)
            {
                s[i] = (char)(BaseRandChar + Next32());
            }

            // 위치코드 세팅
            s[0] = (char)(BaseRandChar + loc[0]);
            s[1] = (char)(BaseRandChar + loc[1]);
            s[34] = (char)(BaseRandChar + loc[2]);
            s[35] = (char)(BaseRandChar + loc[3]);

            // hidden_patt(2..33)에 시드 니블 분산 삽입
            byte n12 = (byte)((sessionSeed >> 12) & 0x0f);
            byte n8 = (byte)((sessionSeed >> 8) & 0x0f);
            byte n4 = (byte)((sessionSeed >> 4) & 0x0f);
            byte n0 = (byte)(sessionSeed & 0x0f);

            s[2 + loc[0]] = (char)(BaseRandChar + n12);
            s[2 + loc[1]] = (char)(BaseRandChar + n8);
            s[2 + loc[2]] = (char)(BaseRandChar + n4);
            s[2 + loc[3]] = (char)(BaseRandChar + n0);

            // margin 중 랜덤 위치에 0을 넣는 코드가 레퍼런스에 있으나,
            // 문자열 전송에서는 NUL 포함이 곤란하므로 Host 쪽은 생략한다.
            return new string(s);
        }

        /// <summary>
        /// 모듈/봇: crcv.seed=&lt;mark&gt; 수신 시 세션 시드 복구.
        /// (secure_fw.c: decode_session_seed)
        /// </summary>
        public static ushort DecodeSeedMarkString(string mark44)
        {
            if (mark44 == null) throw new ArgumentNullException(nameof(mark44));
            if (mark44.Length < 36) throw new ArgumentException("mark 문자열이 너무 짧습니다.", nameof(mark44));

            int loc0 = mark44[0] - BaseRandChar;
            int loc1 = mark44[1] - BaseRandChar;
            int loc2 = mark44[34] - BaseRandChar;
            int loc3 = mark44[35] - BaseRandChar;

            int n12 = mark44[2 + loc0] - BaseRandChar;
            int n8 = mark44[2 + loc1] - BaseRandChar;
            int n4 = mark44[2 + loc2] - BaseRandChar;
            int n0 = mark44[2 + loc3] - BaseRandChar;

            n12 &= 0x0f; n8 &= 0x0f; n4 &= 0x0f; n0 &= 0x0f;
            return (ushort)((n12 << 12) | (n8 << 8) | (n4 << 4) | n0);
        }

        /// <summary>
        /// "&lt;prefix&gt;.&lt;encoded_hex&gt;" 수신 시 복호화하여 "&lt;prefix&gt;.&lt;plaintext&gt;" 반환.
        /// 실패하면 null.
        /// </summary>
        public static string? TryDecryptLine(string line, ushort sessionSeed)
        {
            if (string.IsNullOrWhiteSpace(line)) return null;
            int dot = line.IndexOf('.');
            if (dot <= 0) return null;

            string prefix = line.Substring(0, dot).Trim();
            if (string.IsNullOrWhiteSpace(prefix)) return null;

            string payload = line.Substring(dot + 1).Trim();
            if (payload.Length != 32) return null;
            if (!payload.All(IsHexChar)) return null;

            byte[] d = HexToBytes(payload);
            if (!TryDecryptBytes(d, sessionSeed, out var plain16)) return null;

            // 15바이트만 문자열로 사용 (나머지는 CRC)
            var msg15 = plain16.Take(15).ToArray();
            int end = Array.FindLastIndex(msg15, b => b != 0x00);
            if (end < 0) return prefix + ".";
            string inner = Encoding.ASCII.GetString(msg15, 0, end + 1);
            return prefix + "." + inner;
        }

        public static string EncryptInnerToLine(string prefix, string innerPlain, ushort sessionSeed)
        {
            prefix = (prefix ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(prefix)) prefix = "crcv";
            innerPlain ??= string.Empty;
            var bytes = Encoding.ASCII.GetBytes(innerPlain);
            byte[] p15 = new byte[15];
            int copy = Math.Min(15, bytes.Length);
            Array.Copy(bytes, 0, p15, 0, copy);

            byte[] c16 = EncryptBytes(p15, sessionSeed);
            return prefix + "." + BytesToHex(c16);
        }

        private static bool TryDecryptBytes(byte[] data16, ushort sessionSeed, out byte[] plain16)
        {
            plain16 = new byte[16];
            Array.Copy(data16, plain16, 16);

            byte s0 = (byte)(sessionSeed & 0x0f);
            byte s4 = (byte)((sessionSeed >> 4) & 0x0f);
            byte s8 = (byte)((sessionSeed >> 8) & 0x0f);
            byte s12 = (byte)((sessionSeed >> 12) & 0x0f);

            for (int i = 15; i >= 0; i--)
            {
                byte b = plain16[i];
                byte x;
                switch (i & 3)
                {
                    case 3:
                        x = (byte)((b - i) ^ HtoaNibble(s12));
                        plain16[i] = (byte)(x - 0x28);
                        break;
                    case 2:
                        x = (byte)((b - i) ^ HtoaNibble(s8));
                        plain16[i] = (byte)(x - 0x37);
                        break;
                    case 1:
                        x = (byte)((b - i) ^ HtoaNibble(s4));
                        plain16[i] = (byte)(x - 0x46);
                        break;
                    default:
                        x = (byte)((b - i) ^ HtoaNibble(s0));
                        plain16[i] = (byte)(x - 0x55);
                        break;
                }
            }

            // swap
            Swap(plain16, s0, s12);
            Swap(plain16, s4, s8);

            // CRC 검증: 레퍼런스는 crc_8(buf,16) == 0 이면 통과
            return Crc8(plain16, 16) == 0;
        }

        private static byte[] EncryptBytes(byte[] plain15, ushort sessionSeed)
        {
            byte s0 = (byte)(sessionSeed & 0x0f);
            byte s4 = (byte)((sessionSeed >> 4) & 0x0f);
            byte s8 = (byte)((sessionSeed >> 8) & 0x0f);
            byte s12 = (byte)((sessionSeed >> 12) & 0x0f);

            byte[] c = new byte[16];
            Array.Copy(plain15, 0, c, 0, 15);
            c[15] = Crc8(c, 15);

            Swap(c, s0, s12);
            Swap(c, s4, s8);

            for (int i = 0; i < 16; i++)
            {
                byte b = c[i];
                byte tmp;
                switch (i & 3)
                {
                    case 0:
                        tmp = (byte)(b + 0x55);
                        c[i] = (byte)((tmp ^ HtoaNibble(s0)) + i);
                        break;
                    case 1:
                        tmp = (byte)(b + 0x46);
                        c[i] = (byte)((tmp ^ HtoaNibble(s4)) + i);
                        break;
                    case 2:
                        tmp = (byte)(b + 0x37);
                        c[i] = (byte)((tmp ^ HtoaNibble(s8)) + i);
                        break;
                    default:
                        tmp = (byte)(b + 0x28);
                        c[i] = (byte)((tmp ^ HtoaNibble(s12)) + i);
                        break;
                }
            }

            return c;
        }

        private static void Swap(byte[] buf, int a, int b)
        {
            a &= 0x0f; b &= 0x0f;
            if (a == b) return;
            byte t = buf[a];
            buf[a] = buf[b];
            buf[b] = t;
        }

        private static byte HtoaNibble(int n)
        {
            n &= 0x0f;
            return (byte)(n <= 9 ? ('0' + n) : ('a' + (n - 10)));
        }

        private static bool IsHexChar(char c)
        {
            return (c >= '0' && c <= '9') ||
                   (c >= 'a' && c <= 'f') ||
                   (c >= 'A' && c <= 'F');
        }

        private static byte[] HexToBytes(string hex)
        {
            byte[] b = new byte[hex.Length / 2];
            for (int i = 0; i < b.Length; i++)
            {
                int hi = FromHex(hex[i * 2]);
                int lo = FromHex(hex[i * 2 + 1]);
                b[i] = (byte)((hi << 4) | lo);
            }
            return b;
        }

        private static int FromHex(char c)
        {
            if (c >= '0' && c <= '9') return c - '0';
            c = char.ToLowerInvariant(c);
            if (c >= 'a' && c <= 'f') return c - 'a' + 10;
            throw new ArgumentException("invalid hex char");
        }

        private static string BytesToHex(byte[] bytes)
        {
            var sb = new StringBuilder(bytes.Length * 2);
            foreach (byte b in bytes)
            {
                sb.Append("0123456789abcdef"[b >> 4]);
                sb.Append("0123456789abcdef"[b & 0x0f]);
            }
            return sb.ToString();
        }

        /// <summary>
        /// secure_fw.c의 crc_8()를 그대로 이식.
        /// - poly 0x07, init 0x00
        /// - size 바이트 처리 후 0x00 1바이트를 추가로 처리
        /// </summary>
        private static byte Crc8(byte[] source, int size)
        {
            byte crc = 0;
            for (int cnt = 0; cnt <= size; cnt++)
            {
                byte ch = (cnt == size) ? (byte)0 : source[cnt];
                for (int bit = 0; bit < 8; bit++)
                {
                    bool flag = (crc & 0x80) != 0;
                    crc <<= 1;
                    if ((ch & 0x80) != 0) crc |= 0x01;
                    else crc &= 0xFE;
                    if (flag) crc ^= 0x07;
                    ch <<= 1;
                }
            }
            return crc;
        }
    }
}

