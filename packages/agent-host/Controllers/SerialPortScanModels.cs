namespace CareReceiverAgent.Host.Controllers
{
    public class SerialPortAutoScanRequest
    {
        public int BaudRate { get; set; } = 9600;
        public int TimeoutMs { get; set; } = 400;
    }

    public class SerialPortAutoScanResult
    {
        public string PortName { get; set; } = string.Empty;
        public bool TxOk { get; set; } = false;
        public bool RxOk { get; set; } = false;
        public string? RxLine { get; set; }
        public string? Error { get; set; }
    }
}

