exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: process.env.OWM_API_KEY })
  };
};