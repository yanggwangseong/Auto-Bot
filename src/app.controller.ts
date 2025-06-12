import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  health() {
    return 'ok';
  }

  @Get('create-mimo-thread')
  createMimoThread() {
    return this.appService.createMimoThread();
  }

  @Get('create-core-time-thread')
  createCoreTimeThread() {
    return this.appService.createCoreTimeThread();
  }
}
