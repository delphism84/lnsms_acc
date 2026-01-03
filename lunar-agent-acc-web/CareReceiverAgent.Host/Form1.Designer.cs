namespace CareReceiverAgent.Host;

partial class Form1
{
    /// <summary>
    ///  Required designer variable.
    /// </summary>
    private System.ComponentModel.IContainer components = null;

    /// <summary>
    ///  Clean up any resources being used.
    /// </summary>
    /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
    protected override void Dispose(bool disposing)
    {
        if (disposing && (components != null))
        {
            components.Dispose();
        }
        base.Dispose(disposing);
    }

    #region Windows Form Designer generated code

    /// <summary>
    ///  Required method for Designer support - do not modify
    ///  the contents of this method with the code editor.
    /// </summary>
    private void InitializeComponent()
    {
        this.components = new System.ComponentModel.Container();
        this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
        this.ClientSize = new System.Drawing.Size(900, 600);
        this.Text = "장애인 도움요청 시스팀";
        this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
        this.MaximizeBox = false;
        this.MinimizeBox = false;
        this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
        this.Resize += Form1_Resize;
        this.Load += Form1_Load;
        this.Paint += Form1_Paint;
    }

    private void Form1_Load(object sender, EventArgs e)
    {
        // 로드 이벤트는 Form1.cs에서 처리
    }

    private void Form1_Resize(object sender, EventArgs e)
    {
        // 리사이즈 이벤트는 Form1.cs에서 처리
    }

    #endregion
}
