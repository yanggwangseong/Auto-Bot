import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, TextChannel, ThreadChannel } from 'discord.js';
import {
  DISCORD_ATTENDANCE_CHECK_CHANNEL_ID,
  DISCORD_CORE_TIME_CHANNEL_ID,
  DISCORD_MIMO_CHANNEL_ID,
  DISCORD_PARTICIPANTS,
} from './common/constant';
import { ZonedDateTime, ZoneId } from '@js-joda/core';
import '@js-joda/timezone';

@Injectable()
export class AppService {
  private static attendanceStore = new Map<
    string,
    {
      late: number;
      absent: number;
      totalLate: number;
      totalAbsent: number;
      lastMonth?: string;
    }
  >();
  private static activeUsers = new Set<string>();
  private static inactiveUsers = new Set<string>();
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly client: Client,
  ) {}

  async createMimoThread() {
    const channelId = this.configService.get(DISCORD_MIMO_CHANNEL_ID);
    const channel = this.client.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      const kstZone = ZoneId.of('Asia/Seoul');
      const todayKST = ZonedDateTime.now(kstZone).toLocalDate().toString();
      const threadTitle = `${todayKST} 미모인증`;
      const message = await (channel as any).send(threadTitle);
      await message.startThread({
        name: threadTitle,
        autoArchiveDuration: 60,
      });
      this.logger.log(`${threadTitle} 스레드 생성 완료`);
    } else {
      this.logger.error('채널을 찾을 수 없거나 텍스트 채널이 아닙니다.');
    }
  }

  async createCoreTimeThread() {
    const channelId = this.configService.get(DISCORD_CORE_TIME_CHANNEL_ID);
    const channel = this.client.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      const kstZone = ZoneId.of('Asia/Seoul');
      const todayKST = ZonedDateTime.now(kstZone).toLocalDate().toString();
      const threadTitle = `${todayKST} 코어타임`;
      const message = await (channel as any).send(threadTitle);
      await message.startThread({
        name: threadTitle,
        autoArchiveDuration: 60,
      });
      this.logger.log(`${threadTitle} 스레드 생성 완료`);
    } else {
      this.logger.error('채널을 찾을 수 없거나 텍스트 채널이 아닙니다.');
    }
  }

  /**
   * 출석체크 결과 메시지에서 누적값 복원
   */
  async restoreAttendanceStateFromMessages() {
    const channelId = this.configService.get(
      DISCORD_ATTENDANCE_CHECK_CHANNEL_ID,
    );
    const channel = this.client.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return;
    const textChannel = channel as TextChannel;
    const messages = await textChannel.messages.fetch({ limit: 30 }); // 최근 30개 메시지
    const attendanceStore = AppService.attendanceStore;
    const activeUsers = AppService.activeUsers;
    const inactiveUsers = AppService.inactiveUsers;
    attendanceStore.clear();
    activeUsers.clear();
    inactiveUsers.clear();
    let lastMonth = '';
    messages.forEach((msg) => {
      const lines = msg.content.split('\n');
      let inActiveSection = false;
      let activeSection = false;
      lines.forEach((line) => {
        // 월별 결산 메시지에서 누적값 복원
        const monthMatch = line.match(/^(\d{4}-\d{2}) 출석결과/);
        if (monthMatch) {
          lastMonth = monthMatch[1];
        }
        // 출석 누적값
        const userMatch = line.match(/^(.+) : 지각:(\d+), 결석:(\d+)/);
        if (userMatch) {
          const name = userMatch[1].trim();
          const late = parseInt(userMatch[2], 10);
          const absent = parseInt(userMatch[3], 10);
          // 이름으로 userId 찾기 (userMap 필요)
          // 복원 시점에는 userMap이 없으므로, 이름을 userId로 매핑하는 별도 로직 필요
          // 여기서는 이름을 userId로 사용(환경변수에 userId:이름 매핑이므로 역매핑 필요)
          // 실제 복원은 attendanceCheck에서 userMap을 받아서 처리
          attendanceStore.set(name, {
            late,
            absent,
            totalLate: late,
            totalAbsent: absent,
            lastMonth,
          });
        }
        // Active/InActive 섹션 구분
        if (line.startsWith('Active')) {
          activeSection = true;
          inActiveSection = false;
        } else if (line.startsWith('InActive')) {
          inActiveSection = true;
          activeSection = false;
        } else if (line.startsWith('-')) {
          const name = line.replace('-', '').trim();
          if (activeSection) activeUsers.add(name);
          if (inActiveSection) inactiveUsers.add(name);
        }
      });
    });
  }

  async attendanceCheck() {
    // 1. 참여자 목록/닉네임 매핑
    const PARTICIPANTS = this.configService.get<string>(DISCORD_PARTICIPANTS)!;
    const userMap = PARTICIPANTS.split(',').reduce(
      (acc, pair) => {
        const [id, name] = pair.split(':');
        acc[id.trim()] = name.trim();
        return acc;
      },
      {} as Record<string, string>,
    );
    const userIds = Object.keys(userMap);
    const nameToId = Object.fromEntries(
      Object.entries(userMap).map(([id, name]) => [name, id]),
    );

    // 1-1. 누적값 복원
    await this.restoreAttendanceStateFromMessages();
    // 복원된 attendanceStore의 key가 이름이므로, userId로 변환
    const attendanceStore = AppService.attendanceStore;
    const activeUsers = AppService.activeUsers;
    const inactiveUsers = AppService.inactiveUsers;
    for (const [name, record] of attendanceStore.entries()) {
      const id = nameToId[name];
      if (id) {
        attendanceStore.set(id, record);
        attendanceStore.delete(name);
        if (activeUsers.has(name)) {
          activeUsers.add(id);
          activeUsers.delete(name);
        }
        if (inactiveUsers.has(name)) {
          inactiveUsers.add(id);
          inactiveUsers.delete(name);
        }
      }
    }

    // 2. 오늘 날짜 스레드 찾기
    const mimoThread = await this.findTodayThread(
      this.configService.get(DISCORD_MIMO_CHANNEL_ID)!,
      '미모인증',
    );
    const coreThread = await this.findTodayThread(
      this.configService.get(DISCORD_CORE_TIME_CHANNEL_ID)!,
      '코어타임',
    );

    // 3. 각 스레드에서 멤버별 첫 메시지 시간 수집
    const mimoTimes = mimoThread
      ? await this.getFirstMessageTimes(mimoThread)
      : {};
    const coreTimes = coreThread
      ? await this.getFirstMessageTimes(coreThread)
      : {};

    // 4. 출석/지각/결석 판정
    const result = this.judgeAttendance(userIds, mimoTimes, coreTimes);

    // 5. 결과 메시지 생성
    const kstZone = ZoneId.of('Asia/Seoul');
    const now = ZonedDateTime.now(kstZone);
    const todayKST = now.toLocalDate().toString();
    const currentMonth = `${now.year()}-${String(now.monthValue()).padStart(2, '0')}`;

    let msg = `${todayKST} 출석체크 결과\n`;
    for (const id of userIds) {
      const { late, absent } = result[id] || { late: 0, absent: 1 };
      if (!attendanceStore.has(id)) {
        attendanceStore.set(id, {
          late: 0,
          absent: 0,
          totalLate: 0,
          totalAbsent: 0,
          lastMonth: currentMonth,
        });
        activeUsers.add(id);
      }

      const record = attendanceStore.get(id)!;
      record.totalLate += late;
      record.totalAbsent += absent;
      if (record.totalLate >= 3) {
        record.totalAbsent += 1;
        record.totalLate = 0;
        activeUsers.delete(id);
        inactiveUsers.add(id);
        msg += `\n정보: \"${userMap[id]}\"님이 경고누적으로 InActive 회원으로 전환 되었습니다.\n`;
      }
      msg += `${userMap[id]} : 지각:${record.totalLate}, 결석:${record.totalAbsent}\n`;
    }

    msg += `\n${currentMonth} 출석결과\n`;
    for (const id of userIds) {
      const record = attendanceStore.get(id)!;
      msg += `${userMap[id]} : 지각:${record.totalLate}, 결석:${record.totalAbsent}\n`;
    }

    msg += `\nActive (${activeUsers.size}명)\n`;
    for (const id of activeUsers) {
      msg += `- ${userMap[id]}\n`;
    }
    msg += `InActive (${inactiveUsers.size}명)\n`;
    for (const id of inactiveUsers) {
      msg += `- ${userMap[id]}\n`;
    }

    const channelId = this.configService.get(
      DISCORD_ATTENDANCE_CHECK_CHANNEL_ID,
    );
    const channel = this.client.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      await (channel as any).send(msg);
      this.logger.log('출석체크 결과 전송 완료');
    } else {
      this.logger.error(
        '출석체크 채널을 찾을 수 없거나 텍스트 채널이 아닙니다.',
      );
    }
  }

  /**
   * 오늘 날짜(YYYY-MM-DD 미모인증, YYYY-MM-DD 코어타임) 스레드 찾기
   */
  async findTodayThread(
    channelId: string,
    threadType: '미모인증' | '코어타임',
  ) {
    const channel = this.client.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return null;
    const textChannel = channel as TextChannel;
    const kstZone = ZoneId.of('Asia/Seoul');
    const todayKST = ZonedDateTime.now(kstZone).toLocalDate().toString();
    const threadTitle = `${todayKST} ${threadType}`;
    // 활성 스레드 목록에서만 찾기
    const activeThreads = await textChannel.threads.fetchActive();
    return (
      activeThreads.threads.find((thread) => thread.name === threadTitle) ||
      null
    );
  }

  /**
   * 스레드 내 멤버별 첫 메시지 작성 시간 수집
   */
  async getFirstMessageTimes(thread: ThreadChannel) {
    const messages = await thread.messages.fetch({ limit: 100 });
    const firstTimes: Record<string, Date> = {};
    messages.forEach((msg) => {
      if (
        !firstTimes[msg.author.id] ||
        msg.createdAt < firstTimes[msg.author.id]
      ) {
        firstTimes[msg.author.id] = msg.createdAt;
      }
    });
    return firstTimes;
  }

  /**
   * 출석/지각/결석 판정
   */
  judgeAttendance(
    participants: string[], // userId 배열
    mimoTimes: Record<string, Date>,
    coreTimes: Record<string, Date>,
  ) {
    const result: Record<string, { late: number; absent: number }> = {};
    const kst = (date: Date) => {
      // UTC → KST 변환
      const utc = date.getTime() + date.getTimezoneOffset() * 60000;
      return new Date(utc + 9 * 60 * 60 * 1000);
    };

    for (const userId of participants) {
      let late = 0;
      let absent = 0;

      const mimo = mimoTimes[userId];
      const core = coreTimes[userId];

      // 미모인증 판정
      if (mimo) {
        const t = kst(mimo);
        if (t.getHours() > 8 || (t.getHours() === 8 && t.getMinutes() > 0)) {
          late += 1;
        }
      }

      // 코어타임 판정
      if (core) {
        const t = kst(core);
        if (t.getHours() < 13 || t.getHours() >= 17) {
          late += 1;
        }
      }

      // 둘 다 없으면 결석
      if (!mimo && !core) {
        absent = 1;
        late = 0;
      }

      result[userId] = { late, absent };
    }
    return result;
  }
}
