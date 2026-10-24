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

tempDir = sh.ExpandEnvironmentStrings("%TEMP%")
daemonLockPath = tempDir & "\ihavecpu-updater-daemon.lock"
Err.Clear
Set daemonLock = fso.OpenTextFile(daemonLockPath, 2, True)
If Err.Number <> 0 Then
  WScript.Quit 0
End If
daemonLock.WriteLine "Active since " & Now

Do
  WScript.Sleep 60000
  If fso.FileExists(ps1) Then
    sh.Run "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & ps1 & """ -Silent", 0, True
  End If
Loop
