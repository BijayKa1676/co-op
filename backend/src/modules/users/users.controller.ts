import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { CurrentUser, CurrentUserPayload } from '@/common/decorators/current-user.decorator';
import { ApiResponseDto } from '@/common/dto/api-response.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new user (admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async create(@Body() dto: CreateUserDto): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.create(dto);
    return ApiResponseDto.success(user, 'User created successfully');
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile with startup info' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  async getMe(@CurrentUser() currentUser: CurrentUserPayload): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.findById(currentUser.id);
    return ApiResponseDto.success(user);
  }

  @Get('me/onboarding-status')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check onboarding status' })
  @ApiResponse({ status: 200, description: 'Onboarding status' })
  async getOnboardingStatus(
    @CurrentUser() currentUser: CurrentUserPayload,
  ): Promise<ApiResponseDto<{ completed: boolean; hasStartup: boolean }>> {
    const status = await this.usersService.getOnboardingStatus(currentUser.id);
    return ApiResponseDto.success(status);
  }

  @Post('me/onboarding')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete onboarding with company info' })
  @ApiResponse({ status: 201, description: 'Onboarding completed' })
  @ApiResponse({ status: 400, description: 'Onboarding already completed' })
  async completeOnboarding(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: OnboardingDto,
  ): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.completeOnboarding(currentUser.id, dto);
    return ApiResponseDto.success(user, 'Onboarding completed successfully');
  }

  @Patch('me/startup')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update startup information' })
  @ApiResponse({ status: 200, description: 'Startup updated' })
  @ApiResponse({ status: 400, description: 'No startup linked' })
  async updateStartup(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: Partial<OnboardingDto>,
  ): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.updateStartup(currentUser.id, dto);
    return ApiResponseDto.success(user, 'Startup updated successfully');
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.findById(id);
    return ApiResponseDto.success(user);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async updateMe(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: UpdateUserDto,
  ): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.update(currentUser.id, dto);
    return ApiResponseDto.success(user, 'Profile updated successfully');
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user (admin only)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.usersService.update(id, dto);
    return ApiResponseDto.success(user, 'User updated successfully');
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user (admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<null>> {
    await this.usersService.delete(id);
    return ApiResponseDto.message('User deleted successfully');
  }
}
