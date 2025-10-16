; NSIS include file for electron-builder custom installer steps.
; Add custom installation logic inside the macros below as needed.

!include "LogicLib.nsh"

!macro customInit
  ; Placeholder for initialization logic before the installer UI shows.
!macroend

!macro customInstall
  DetailPrint "初始化 Python 環境..."
  ; 以提升的權限執行 setup-python.cmd
  nsExec::ExecToLog "\"$SYSDIR\\cmd.exe\" /C \"\"$INSTDIR\\resources\\scripts\\setup-python.cmd\"\""
  Pop $0
  ${If} $0 != 0
    DetailPrint "Python 環境初始化失敗 (錯誤碼 $0)"
  MessageBox MB_OK|MB_ICONEXCLAMATION "Python 環境初始化失敗 (錯誤碼 $0)。請於安裝後手動執行 setup-python.cmd（位於安裝目錄的 resources/scripts）來建立環境。"
  ${Else}
    DetailPrint "Python 環境初始化完成。"
  ${EndIf}
!macroend

!macro customUnInstall
  ; Placeholder for custom uninstall actions.
!macroend
