## Sprint1

- github Actions 배치 돌리기
- 코어타임 인증
- 참여자 등록
- 매일 오후 10시에 정산 동작
  - continue 등록이면 체크 안함
  - 1주일 미모인증, 코어타임 인증 정산
  - 1달 지각/경고 정산 및 초기화 및 자동 InActive

```yml
name: Mimo Thread Job

on:
  schedule:
    - cron: '50 23 * * *' # 매일 오전 8:50 KST

jobs:
  create-mimo-thread:
    runs-on: ubuntu-latest
    steps:
      - name: Call Mimo Thread API
        run: |
          curl -X GET https://auto-bot-swart.vercel.app/create-mimo-thread

name: Core Time Thread Job

on:
  schedule:
    - cron: '50 5 * * *' # 매일 오후 2:50 KST

jobs:
  create-core-time-thread:
    runs-on: ubuntu-latest
    steps:
      - name: Call Core Time Thread API
        run: |
          curl -X GET https://auto-bot-swart.vercel.app/create-core-time-thread

```

## slash 사용문제

- serverless 환경에서 Slash 사용은 한계가 있다.
