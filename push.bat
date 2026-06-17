@echo off
REM Commit tat ca thay doi va day len git
setlocal

REM Lay thong diep commit tu tham so, neu khong co thi dung thoi gian hien tai
set "MSG=%*"
if "%MSG%"=="" set "MSG=update %date% %time%"

echo === git add ===
git add -A

echo === git commit ===
git commit -m "%MSG%"

echo === git push ===
git push

echo === Hoan tat ===
endlocal
pause
