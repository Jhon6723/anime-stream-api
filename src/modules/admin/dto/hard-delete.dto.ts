import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class HardDeleteDto {
  @ApiProperty({
    example: 'CONFIRM',
    description: 'Must be "CONFIRM" to proceed',
  })
  @IsString()
  @MinLength(1)
  confirm: string;

  @ApiProperty({ example: 'Violación de DMCA' })
  @IsString()
  @MinLength(1)
  reason: string;
}
