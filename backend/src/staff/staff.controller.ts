import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { StaffsService } from './staff.service';
import { CreateStaffDto, UpdateStaffDto } from './staff.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
@UseGuards(RolesGuard)
export class StaffController {
  constructor(private readonly staffsService: StaffsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all staff members' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  async list(@Query('activeOnly') activeOnly?: string) {
    const onlyActive = activeOnly === 'true';
    const data = await this.staffsService.findAll(onlyActive);
    return { message: 'Staff fetched', data };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single staff member' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.staffsService.findById(id);
    return { message: 'Staff fetched', data };
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new staff member (admin)' })
  async create(@Body() dto: CreateStaffDto) {
    const data = await this.staffsService.create(dto);
    return { message: 'Staff created', data };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a staff member (admin)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    const data = await this.staffsService.update(id, dto);
    return { message: 'Staff updated', data };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a staff member (admin)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.staffsService.remove(id);
    return { message: 'Staff deleted', data: null };
  }
}
