# 심해 진주 줍기 - 방향키 조작 + 효과음/BGM 버전

## 포함 파일
- index.html
- style.css
- script.js
- README.md

## 이번 버전 변경점
- 점프 방식이 아니라, 최초 버전처럼 방향키 상하좌우로 다이버를 직접 움직이는 방식으로 변경했습니다.
- 방향키를 누를 때마다 물방울 느낌의 이동 효과음이 재생됩니다.
- 진주 획득, 장애물 충돌, 게임 시작, 승리, 게임 오버 효과음을 추가했습니다.
- 배경음은 수족관 물소리처럼 맑고 청아한 느낌의 물방울 앰비언스로 구성했습니다.
- 별도 mp3 파일 없이 script.js에서 Web Audio API로 사운드를 직접 생성합니다.

## 적용 방법
기존 vcgame1 폴더의 index.html, style.css, script.js를 이 파일들로 교체한 뒤, VS Code 터미널에서 아래 명령어를 입력하세요.

```bash
git add .
git commit -m "방향키 조작과 수족관 BGM 추가"
git push
```

그 다음 GitHub Pages 주소를 새로고침하면 반영됩니다.
