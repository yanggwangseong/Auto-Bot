## Sprint1

- github Actions 배치 돌리기
- 코어타임 인증
- 참여자 등록
- 1주일 미모인증, 코어타임 인증 정산
- 1달 지각/경고 정산 및 초기화 및 자동 InActive
- continue 등록 스레드

```yml
name: Cron Jobs

on:
  schedule:
    # 매일 오전 10시 (KST)
    - cron: '0 1 * * *'
    # 매일 오후 3시 (KST)
    - cron: '0 6 * * *'

jobs:
  mimo-thread:
    if: github.event.schedule == '0 1 * * *'
    runs-on: ubuntu-latest
    steps:
      - name: Create Mimo Thread
        run: |
          curl -X GET https://auto-bot-swart.vercel.app/create-mimo-thread

  core-time-thread:
    if: github.event.schedule == '0 6 * * *'
    runs-on: ubuntu-latest
    steps:
      - name: Create Core Time Thread
        run: |
          curl -X GET https://auto-bot-swart.vercel.app/create-core-time-thread
```
