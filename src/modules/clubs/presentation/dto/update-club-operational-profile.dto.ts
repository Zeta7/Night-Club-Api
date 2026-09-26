import { OptionalField } from '../../../../shared/presentation/dto-fields';
import { IsArray, IsEmail, IsPhoneNumber, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateClubOperationalProfileDto {
  @OptionalField({ nullable: true, type: String }) @IsString() @MaxLength(5000) refundPolicy?:
    string | null;
  @OptionalField({ nullable: true, type: String }) @IsString() @MaxLength(150) responsibleName?:
    string | null;
  @OptionalField({ nullable: true, type: String }) @IsEmail() responsibleEmail?: string | null;
  @OptionalField({ nullable: true, type: String }) @IsPhoneNumber('PE') responsiblePhone?:
    string | null;
  @OptionalField() @IsArray() @IsUUID('4', { each: true }) approvalDocumentUploadIds?: string[];
}
