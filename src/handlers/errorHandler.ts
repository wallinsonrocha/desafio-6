import { Response } from "express";

export enum ErrorType {
  badRequest = 400,
  unauthorized = 401,
  forbidden = 403,
  notFound = 404,
}

export async function errorHandler(
  resObj: Response,
  errorString: string,
  errorType: ErrorType = 400,
  prefix: string = "Error: "
) {
  // custom errors
  if (errorString.includes("customError:")) {
    errorString = errorString
      .replace("customError: ", "")
      .replace("Error: ", "");

    resObj.status(errorType).json({
      message: prefix + errorString,
      errorCode: errorType,
    });

    return;
  }

  // unexpected errors
  resObj.status(errorType).json({
    message:
      "An unexpected error occurred, please wait a while and try again, or contact an administrator",
    errormsg: errorString,
    errorCode: errorType,
  });
}
