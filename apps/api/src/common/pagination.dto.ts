import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * DTO chuẩn cho các API phân trang Cursor-based (phù hợp với đồ thị phả hệ và dòng thời gian mạng xã hội).
 */
export class CursorPaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Interface chuẩn cho kết quả trả về của các API phân trang.
 */
export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}
