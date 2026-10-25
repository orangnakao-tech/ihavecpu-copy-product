On Error Resume Next
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = dir & "\update-extension.ps1"

forceFlag = ""
runOnce = False
If WScript.Arguments.Count > 0 Then
  For i = 0 To WScript.Arguments.Count - 1
    arg = LCase(WScript.Arguments(i))
    If InStr(arg, "force") > 0 Then
      forceFlag = " -Force"
    End If
    If InStr(arg, "once") > 0 Then
      runOnce = True
    End If
  Next
End If

If fso.FileExists(ps1) Then
  sh.Run "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & ps1 & """ -Silent" & forceFlag, 0, True
End If

If runOnce Then
  WScript.Quit 0
End If

' ตรวจสอบว่ามี silent-updater.vbs รันอยู่เบื้องหลังแล้วหรือไม่ผ่าน WMI
Err.Clear
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
If Err.Number = 0 Then
  Set procs = wmi.ExecQuery("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name = 'wscript.exe'")
  runningCount = 0
  For Each proc in procs
    If InStr(LCase(proc.CommandLine), "silent-updater.vbs") > 0 Then
      runningCount = runningCount + 1
    End If
  Next
  If runningCount > 1 Then
    WScript.Quit 0
  End If
End If

Do
  WScript.Sleep 60000
  If fso.FileExists(ps1) Then
    sh.Run "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & ps1 & """ -Silent", 0, True
  End If
Loop
