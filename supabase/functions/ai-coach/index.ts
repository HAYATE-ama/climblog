// Course API retired. Old PWA clients cannot trigger generation, settings writes or adoption.
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://hayate-ama.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
Deno.serve(request=>request.method==='OPTIONS'?new Response(null,{status:204,headers}):new Response(JSON.stringify({code:'COURSE_API_RETIRED',message:'コース生成APIは終了しました。アプリを更新し、相談用レポートをご利用ください。'}),{status:410,headers}));
