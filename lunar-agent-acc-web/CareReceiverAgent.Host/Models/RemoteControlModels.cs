using System.Collections.Generic;

namespace CareReceiverAgent.Host.Models
{
    public class RemoteControlButton
    {
        public int Number { get; set; } // 1..15
        public string Name { get; set; } = string.Empty;
        public string SendCode { get; set; } = string.Empty; // raw line to send (without trailing \r)
    }

    public class RemoteControlSettings
    {
        public List<RemoteControlButton> Buttons { get; set; } = new List<RemoteControlButton>();
    }
}

