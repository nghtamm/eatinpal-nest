import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Serialize } from '../../common/decorators/serialize.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { GetUser } from './decorators/user.decorator';
import { RegisterDTO } from './dto/register.dto';
import { AuthResponseDTO } from './dto/response/auth-response.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
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
  @Serialize(AuthResponseDTO)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@GetUser() user: User) {
    return this.authService.login(user);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  refresh(
    @GetUser('id') userID: number,
    @Body('refresh_token') refreshToken: string,
  ) {
    return this.authService.refresh(userID, refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(
    @GetUser('id') userID: number,
    @Body('refresh_token') refreshToken?: string,
  ) {
    return this.authService.logout(userID, refreshToken);
  }
}
