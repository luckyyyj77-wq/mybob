import { NextResponse } from 'next/server';

// This is a placeholder for the actual AI Food Recognition API call.
// In a real application, you would use a library like 'axios' or 'node-fetch'
// to send the image to a service like LogMeal, FatSecret, or another provider.

async function analyzeFoodWithAI(base64Image: string) {
  // 1. Get API Key from environment variables for security
  const apiKey = process.env.FOOD_API_KEY;
  const apiUrl = process.env.FOOD_API_URL;

  // Check if API credentials are provided and valid
  if (!apiKey || !apiUrl || apiKey === "YOUR_API_KEY_HERE" || apiUrl === "YOUR_API_ENDPOINT_HERE") {
    console.log("POST /api/analyze-food: AI Food API credentials not set. Returning mock data for demonstration.");
    // For demonstration, return mock data if API keys are not set
    return {
      success: true,
      food: {
        name: '비빔밥 (데모)',
        calories: 580,
        amount: 1,
        category: '한식',
        price: 9000,
        location: '근처 식당',
        nutrients: {
          carbohydrates: 85, // g
          protein: 20,       // g
          fat: 15,           // g
        }
      }
    };
  }

  console.log("POST /api/analyze-food: AI Food API credentials found. Calling external API...");
  // 2. Prepare the request to the external AI API
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // The body structure depends on the specific API provider
      image: base64Image,
    }),
  });

  if (!response.ok) {
    // Handle API errors
    const errorData = await response.json();
    console.error("POST /api/analyze-food: External AI Food API Error:", errorData);
    throw new Error('Failed to analyze food image.');
  }

  // 3. Parse the response and return it
  const data = await response.json();
  console.log("POST /api/analyze-food: Successfully received data from external API.");

  // The structure of 'data' will vary by API. You need to map it to your own format.
  return {
    success: true,
    food: {
      name: data.food_name,
      calories: data.calories,
      amount: data.serving_size,
      category: data.category,
      price: data.estimated_price,
      location: data.estimated_location,
      nutrients: data.nutritional_info, // e.g., { carbohydrates, protein, fat }
    }
  };
}

export async function POST(request: Request) {
  console.log('POST /api/analyze-food: Received request');
  try {
    const body = await request.json();
    const { image } = body;

    if (!image) {
      console.error('POST /api/analyze-food: No image data in request body.');
      return NextResponse.json({ error: 'Image data is required.' }, { status: 400 });
    }

    // The image data is a base64 string, e.g., "data:image/jpeg;base64,..."
    // Some APIs might require removing the prefix "data:image/jpeg;base64,"
    const base64Data = image.split(',')[1];

    const analysisResult = await analyzeFoodWithAI(base64Data);

    console.log('POST /api/analyze-food: Returning analysis result to client.');
    return NextResponse.json(analysisResult);
  } catch (error) {
    console.error('POST /api/analyze-food: Internal Server Error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
