import { BadRequestException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter (NFR-08)', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  const createMockArgumentsHost = () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockResponse = { status: mockStatus };
    const mockRequest = { url: '/api/test', method: 'GET' };

    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;

    return { mockHost, mockStatus, mockJson };
  };

  it('chuẩn hóa lỗi HttpException (400 Bad Request)', () => {
    const { mockHost, mockStatus, mockJson } = createMockArgumentsHost();
    const exception = new BadRequestException('Dữ liệu không hợp lệ');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        code: 'Bad Request',
        message: 'Dữ liệu không hợp lệ',
        path: '/api/test',
      }),
    );
  });

  it('chuẩn hóa lỗi chưa xác định thành 500 Internal Server Error', () => {
    const { mockHost, mockStatus, mockJson } = createMockArgumentsHost();
    const exception = new Error('Unexpected crash');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        path: '/api/test',
      }),
    );
  });
});

