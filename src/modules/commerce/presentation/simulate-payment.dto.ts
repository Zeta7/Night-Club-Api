import { IsIn } from 'class-validator';
import { PaymentOutcome } from '../application/ports/payment-gateway.port';

export class SimulatePaymentDto {
  @IsIn(['APPROVED', 'REJECTED', 'PENDING', 'EXPIRED', 'REFUNDED', 'CHARGEBACK'])
  outcome!: PaymentOutcome;
}
