import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import createHttpError from 'http-errors';
import cors from '@middy/http-cors';
import validator from '@middy/validator';
import isBase64 from 'is-base64';

import { uploadPictureToS3 } from '../lib/uploadPicture';
import { getAuctionById } from './getAuction';
import { setAuctionPictureUrl } from '../lib/setAuctionPictureUrl';
import uploadAuctionPictureSchema from '../lib/schemas/uploadAuctionPictureSchema';

async function uploadAuctionPicture(event, context) {
	let updatedAuction;

	const { id } = event.pathParameters;
	const { email } = event.requestContext.authorizer;

	const auction = await getAuctionById(id);

	if (auction.seller !== email) {
		throw new createHttpError.Forbidden(`Permission denied`);
	}

	const base64 = event.body.replace(/^data:image\/\w+;base64,/, '');
	if (!isBase64(base64)) {
		throw new createHttpError.Forbidden(`Please provide a base64 string`);
	}
	const buffer = Buffer.from(base64, 'base64');

	try {
		const pictureUrl = await uploadPictureToS3(auction.id + '.jpg', buffer);
		updatedAuction = await setAuctionPictureUrl(id, pictureUrl);
	} catch (error) {
		console.error(error);
		throw new createHttpError.InternalServerError(error);
	}

	return {
		statusCode: 200,
		body: JSON.stringify(updatedAuction),
	};
}

export const handler = middy(uploadAuctionPicture)
	.use(httpErrorHandler())
	.use(cors())
	.use(
		validator({
			inputSchema: uploadAuctionPictureSchema,
			ajvOptions: {
				useDefaults: true,
				strict: false,
			},
		})
	);
