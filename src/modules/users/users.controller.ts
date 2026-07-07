import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { Serialize } from '../../common/decorators/serialize.decorator';
import { GetUser } from '../../common/decorators/user.decorator';
import { OnboardingDTO } from './dtos/onboarding.dto';
import { OnboardingResponseDTO } from './dtos/response/onboarding-response.dto';
import { NutritionGoalResponseDTO } from './dtos/response/nutrition-goal-response.dto';
import { ProfileResponseDTO } from './dtos/response/profile-response.dto';
import { SetNutritionGoalDTO } from './dtos/set-nutrition-goal.dto';
import { UpdateProfileDTO } from './dtos/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('me/onboarding')
  @Serialize(OnboardingResponseDTO)
  onboarding(@GetUser('id') userID: number, @Body() dto: OnboardingDTO) {
    return this.usersService.onboarding(userID, dto);
  }

  @Get('me/profile')
  @Serialize(ProfileResponseDTO)
  getProfile(@GetUser('id') userID: number) {
    return this.usersService.getOrCreateProfile(userID);
  }

  @Patch('me/profile')
  @Serialize(ProfileResponseDTO)
  updateProfile(@GetUser('id') userID: number, @Body() dto: UpdateProfileDTO) {
    return this.usersService.updateProfile(userID, dto);
  }

  @Get('me/nutrition-goal')
  @Serialize(NutritionGoalResponseDTO)
  getNutritionGoal(@GetUser('id') userID: number) {
    return this.usersService.getNutritionGoal(userID);
  }

  @Put('me/nutrition-goal')
  @Serialize(NutritionGoalResponseDTO)
  setNutritionGoal(
    @GetUser('id') userID: number,
    @Body() dto: SetNutritionGoalDTO,
  ) {
    return this.usersService.setNutritionGoal(userID, dto);
  }

  @Post('me/nutrition-goal/recalculate')
  @HttpCode(HttpStatus.OK)
  @Serialize(NutritionGoalResponseDTO)
  recalculateNutritionGoal(@GetUser('id') userID: number) {
    return this.usersService.recalculateNutritionGoal(userID);
  }
}
