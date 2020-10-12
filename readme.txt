Clone git repo and install node modules
    git clone https://github.com/itpednekar/NodeJS_Assignment.git
    cd NodeJS_Assignment
    npm install

To start the server
    nodemon server.js 

On the browser
     http://localhost:3000
Login credentials 
    {
        email : itpednekar16@gmail.com,
        password : ishwari123
    }

Database (PostgreSQL)
    Replace database properties in .env file
Get all database data from dump.sql
        psql -h localhost -U <username> <database name> < dump.sql

CSV file get created in public folder everyday at 11 : 58 PM
    



