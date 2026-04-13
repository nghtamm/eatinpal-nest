import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { GetUser } from './decorators/user.decorator';
import { RegisterDTO } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDTO) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@GetUser() user: User) {
    return this.authService.login(user);
  }

  @Public()
  @Post('refresh')
  refresh(
    @GetUser('id') userID: number,
    @Body('refresh_token') refreshToken: string,
  ) {
    return this.authService.refresh(userID, refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @GetUser('id') userID: number,
    @Body('refresh_token') refreshToken?: string,
  ) {
    return this.authService.logout(userID, refreshToken);
  }
}
