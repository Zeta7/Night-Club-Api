import { IsArray, IsEmail, IsOptional, IsPhoneNumber, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateClubOperationalProfileDto {
  @IsOptional() @IsString() @MaxLength(5000) refundPolicy?: string;
  @IsOptional() @IsString() @MaxLength(150) responsibleName?: string;
  @IsOptional() @IsEmail() responsibleEmail?: string;
  @IsOptional() @IsPhoneNumber('PE') responsiblePhone?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) approvalDocumentUploadIds?: string[];
}
