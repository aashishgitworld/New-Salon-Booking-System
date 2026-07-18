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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List payments (admin)' })
  @ApiQuery({ name: 'appointmentId', required: false })
  async list(@Query('appointmentId') appointmentId?: string) {
    const data = await this.paymentsService.findAll(appointmentId);
    return { message: 'Payments fetched', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a payment (admin)' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.paymentsService.findById(id);
    return { message: 'Payment fetched', data };
  }

  @Post()
  @ApiOperation({ summary: 'Create a payment (admin)' })
  async create(@Body() dto: CreatePaymentDto) {
    const data = await this.paymentsService.create(dto);
    return { message: 'Payment created', data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a payment (admin)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    const data = await this.paymentsService.update(id, dto);
    return { message: 'Payment updated', data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a payment (admin)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.paymentsService.remove(id);
    return { message: 'Payment deleted', data: null };
  }
}
