# Convenient Portal
The **Convenient Portal** is an online platform designed to streamline and enhance the learning experience for students, teachers, and parents. The portal integrates various features to facilitate smooth communication, efficient learning, and effective progress tracking. Key elements of the portal include:

### 1. Student Progress Tracking
- Detailed reports on student performance in individual classes and assignments.
- Feedback on learning gaps, strengths, and areas for improvement.
- Monitoring and tracking of missed classes through automated email or WhatsApp notifications.

### 2. Interactive Lessons and Assignments
- Access to lesson materials, recorded sessions, and interactive content.
- Assignments available for students to complete, helping to reinforce key concepts.
- Ability to submit assignments directly through the portal, with automatic grading and feedback.

### 3. Personalized Learning Plans
- Tailored suggestions for additional resources or classes based on individual progress.
- AI-powered recommendations to optimize learning paths for each student.

### 4. Class Scheduling and Communication
- A scheduling system that enables students and teachers to view and manage upcoming classes.
- Direct messaging between teachers, students, and parents to discuss performance, concerns, and progress.

### 5. Reports and Analytics
- Data-driven insights into student engagement, class participation, and overall performance.
- Access to past exam papers and practice tests to ensure thorough exam preparation.

### 6. Exam Preparation and Revision Tools
- A dedicated section for exam preparation with focused materials, past papers, and mock tests.
- Additional support services, such as intensive review classes, to address learning gaps before exams.

### 7. Multi-Device Access
- The portal is accessible across various devices, including desktop, tablet, and mobile, ensuring flexibility for students and teachers.

### 8. Support for Extra Classes
- Access to supplementary classes for students who require extra help, ensuring no one falls behind.

The **Convenient Education Portal** is continuously updated to integrate the latest technological advancements, ensuring that both the teaching and learning experiences remain cutting-edge and efficient.

## Current Version 1.0.4

### Services being used:

#### 1. argon2
- **Password Hashing**: Securely hashes user passwords before storing them in the database.
- **Password Verification**: Verifies the hashed password against the stored hash during login.
- **Security Enhancements**: Provides resistance against various types of attacks, enhancing overall security.

#### 2. cors
- **Cross-Origin Resource Sharing (CORS)**: Allows or restricts resources to be requested from another domain.
- **Configuration**: Manages allowed origins, methods, and headers for secure access.
- **Security**: Prevents unauthorized access, ensuring only trusted domains can interact with resources.

#### 3. dotenv
- **Environment Variables Management**: Loads environment variables from a `.env` file into `process.env`.
- **Configuration**: Easily switches between different environments without changing the code.
- **Security**: Keeps sensitive information out of the source code.

#### 4. express
- **Web Framework**: Provides a robust set of features for building server-side logic.
- **Routing**: Handles routing for efficient request and response management.
- **Middleware**: Manages tasks such as parsing request bodies, managing sessions, and handling errors.
- **Scalability**: Supports growth, handling an increasing number of users and requests.
- **Integration**: Integrates seamlessly with other services and libraries.

#### 5. jsonwebtoken
- **Token-Based Authentication**: Implements secure communication between client and server.
- **User Sessions**: Maintains user sessions without server-side storage.
- **Security**: Ensures integrity and confidentiality of token data.
- **Stateless Authentication**: Reduces server load and improves scalability.
- **Role-Based Access Control**: Enables fine-grained access control based on user roles.
- **Class-Specific Tokens**: Generates unique tokens for each class for secure access.
- **Activity Validation**: Validates class-specific tokens for authorized access.
- **Token Management**: Manages token lifecycle for secure access control.

#### 6. mysql2
- **Database Connection**: Establishes and manages connections to the MySQL database.
- **Query Execution**: Executes SQL queries for CRUD operations.
- **Prepared Statements**: Prevents SQL injection attacks.
- **Connection Pooling**: Manages multiple database connections efficiently.
- **Promise Support**: Handles asynchronous database operations effectively.
- **Error Handling**: Ensures stability with robust error handling mechanisms.

#### 7. newrelic
- **Performance Monitoring**: Provides insights into response times, throughput, and error rates.
- **Error Tracking**: Tracks and reports errors in real-time.
- **Transaction Tracing**: Pinpoints performance bottlenecks.
- **Alerts and Notifications**: Sends alerts for performance anomalies.
- **Dashboard and Reporting**: Visualizes performance metrics and trends.
- **Integration**: Provides a unified view of application performance and health.

#### 8. rate-limiting
- **Request Rate Limiting**: Controls the number of requests within a specified time frame.
- **Configuration**: Configures limits on various endpoints.
- **Security**: Mitigates the risk of denial-of-service (DoS) attacks.
- **User Experience**: Maintains a smooth user experience by preventing server overload.
- **Logging and Monitoring**: Logs rate-limiting events and monitors usage patterns.

#### 9. winston
- **Logging**: Logs application events, errors, and significant activities.
- **Log Levels**: Categorizes and prioritizes log messages.
- **Transport Mechanisms**: Supports multiple transport mechanisms for logs.
- **Format Customization**: Customizes log formats for readability and usefulness.
- **Error Handling**: Captures and logs errors for quick diagnosis.
- **Performance Monitoring**: Logs performance-related data to identify bottlenecks.
- **Integration**: Integrates with other monitoring and alerting tools.

## Routes
We are using three routes:
1. **Authentication Route (auth.js)**: Used for authentication functions such as logging in.
2. **Portal Route (portal.js)**: Used for portal functions such as joining classes, cancelling, making changes, adding and removing classes.
3. **User Route (users.js)**: Used for user creation.


## Features
1. **TLS server:** We are using Caddy to get access to https.
2. **Ports:** We are using 30001 port for connection locally
3. **Firewall** We are using firewall to stop connection to any service in the server other than Caddy port 80 and 443

## Endpoints
### Users
1. **api.convenientedu.com/user/username/:username**: Used for checking if username is available in the system. *While I think this can be a cyber security risk, I still think we need to make a go with a better option*
    * **Connection Type**: GET
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]
2. **api.convenientedu.com/user/country_list**: Used to get list of countries currently supported, while this could be done on the front end side, we still prefer doing it in backend for immediate changes.
    * **Connection Type**: GET
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]

2. **api.convenientedu.com/user/subject**: Used to get the list of the subjects currently offered.
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]

2. **api.convenientedu.com/user/insert/parent**: Used to insert a new parent into the mysql server.
    * **Connection Type**: POST
    * **Inputs**: [username, firstname, lastname, password, country]
    * Takes in a JSON
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]

2. **api.convenientedu.com/user/add/student**: Used to add in a student, it can take both student types but it will need an update late on.
    * **Connection Type**: POST
    * **Inputs**: [username, firstname, lastname, password, country, classroom, studentType]
    * Takes in a JSON
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**PARENT**"]

2. **api.convenientedu.com/user/insert/classroom**: Used to insert a new classroom
    * **Connection Type**: POST
    * **Inputs**: [
        classroomName, maxStudents, managerID, classtype, parentID
    ]
    * Takes in a JSON
    * **Accessible By**: ["**ADMIN**", "**MANAGER**"]

2. **api.convenientedu.com/user/insert/teacher**: Used to insert new teachers, it will take in time for each and every day individually.
    * **Connection Type**: POST
    * **Inputs**: [
        username, firstname, lastname, password, country, subject, monday, tuesday, wednesday, thursday, friday, saturday, sunday
    ]
    * **Accessible By**: ["**ADMIN**"]
2. **api.convenientedu.com/user/insert/manager**: Used to insert a new manager.
    * **Inputs**: [username, firstname, lastname, password, country]
2. **api.convenientedu.com/user/insert/admin**: Used to insert a new admin.
    **Connection Type**: POST
    **Inputs**: [
        username, firstname, lastname, password, country]
    * **Accessible By**: ["**ADMIN**"]
2. **api.convenientedu.com/user/insert/student/support**: Used to insert new support student but can only be access by an admin
    * **Inputs**: [username, firstname, lastname, password, country, parentID, className]
    * **Accessible By**: ["**ADMIN**"]

2. **api.convenientedu.com/user/insert/student/general**: Used to insert general students but can only be accessed by an admin.
    * **Inputs**: [username, firstname, lastname, password, country, parentID, classroom]
    * **Accessible By**: ["**ADMIN**"]
2. **api.convenientedu.com/user/** 

### Portal
1. **api.convenientedu.com/portal/insert/class/timetable**: This is to insert a new class into the timetable, while this will take maximum 20 minutes to update on the frontend server. This is a general function.
    * **Inputs**: [classroom, time, day, date, teacher, classname, active]
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]

1. **api.convenientedu.com/portal/insert/class/timetable/support**: This is to insert a support class to the timetable.
    * **Inputs**: [classroom, time, day, date, teacher, classname, active]
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]

1. **api.convenientedu.com/portal/insert/class/history**: This function forces an input to class history, but it is not to be used.
    * **Inputs**: [classID, classDate, classTime]
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]
    > Depreciated
1. **api.convenientedu.com/portal/timetable**: This function fetched data from timetable table but latest insertions can take up to 10 min to showup.
    * **Inputs**: [uid, usertype]
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]

1. **api.convenientedu.com/portal/home**: This function is to fetch data to populate the home page. It will fetch timetables.
    * **Inputs**: [uid, usertype]
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]
1. **api.convenientedu.com/portal/reports**: This function will fetch all the reports.
    * **Inputs**: []
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]
1. **api.convenientedu.com/portal/children**: This function will get the data of all the connected user to the requested user.
    * **Inputs**: []
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]
1. **api.convenientedu.com/portal/add/class/populate**: This function is used to populate the page that is used to populate add class page.
    * **Inputs**: []
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]
1. **api.convenientedu.com/portal/join**: This function is used to join a class and it takes the special token for that class instance. 
    * **Inputs**: [classToken]
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]
1. **api.convenientedu.com/portal/cancel**: This function is used to cancel a class, and it takes the special token for the class instance.
    * **Inputs**: [classToken]
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]

### Auth
1. **api.convenientedu.com/auth/login**: This function will take in a username and password and return a **auth token**.
    * **Inputs**: ["**username**", "**password**"]
    * **Accessible By**: ["**ADMIN**", "**MANAGER**", "**STUDENT**, **TEACHER**", "**PARENT**"]

# Example Requests
Following are requests that can be made to the above endpoints.

## **<span style="color: orange;">POST</span>**  Create Manager
Following is the JSON object that will be send to the server to make a new manager. This will me made to *https://api.convenientedu.com/user/insert/manager*
```
    {
    "username": "some_manager", 
    "firstname": "Some", 
    "lastname": "Manager", 
    "password": "SomePassword", 
    "country": "PK",
    "AuthToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9. eyJ1c2VybmFtZSI6Ik11aGFtbWFkIiwidXNlcnR5cGUiOiJBRE1JTiIsInVpZCI6MSwiaWF0IjoxNzM4MzQ4MTI2LCJleHAiOjE3MzgzODQxMjZ9.j-DlH5QZvSDhbnKQVOLTka3dx7qg--S-t93y0nhbWq8"
    }
```

## **<span style="color: orange;">POST</span>**  Create Admin
Following is the JSON object that will be send to the server to make a new admin. This will me made to *https://api.convenientedu.com/user/insert/admin*
```
{
    "username": "some_admin", 
    "firstname": "Some", 
    "lastname": "Admin", 
    "password": "SomePassword", 
    "country": "PK",
    "AuthToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Ik11aGFtbWFkIiwidXNlcnR5cGUiOiJBRE1JTiIsInVpZCI6MSwiaWF0IjoxNzM4MTQ4OTM1LCJleHAiOjE3MzgxODQ5MzV9.XOPVy7cUdnEQJknNpcHkx8rHhFODUxFMhgkFTz0zmjA"
}
```

## **<span style="color: orange;">POST</span>**  Create Teacher
Following is the JSON object that will be send to the server to make a new admin. This will me made to *https://api.convenientedu.com/user/insert/teacher*
```
{
    "username":"someusername", 
    "firstname":"Some", 
    "lastname":"Teacher", 
    "password":"SomePassword", 
    "country":"PK", 
    "subject": ["CHEMISTRY"], 
    "monday":["11:00:00", "12:00:00", "13:00:00", "14:00:00"], 
    "tuesday":["11:00:00", "12:00:00", "13:00:00", "14:00:00"], 
    "wednesday":["11:00:00", "12:00:00", "13:00:00", "14:00:00"], 
    "thursday":["11:00:00", "12:00:00", "13:00:00", "14:00:00"], 
    "friday":["11:00:00", "12:00:00", "13:00:00", "14:00:00"], 
    "saturday":["11:00:00", "12:00:00", "13:00:00", "14:00:00"], 
    "sunday":["11:00:00", "12:00:00", "13:00:00", "14:00:00"],
    "AuthToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Ik11aGFtbWFkIiwidXNlcnR5cGUiOiJBRE1JTiIsInVpZCI6MSwiaWF0IjoxNzM4MzQ4MTI2LCJleHAiOjE3MzgzODQxMjZ9.j-DlH5QZvSDhbnKQVOLTka3dx7qg--S-t93y0nhbWq8"

}
```

## **<span style="color: orange;">POST</span>**  Create Student
Following is the JSON object that will be send to the server to make a new admin. This will me made to *https://api.convenientedu.com/user/insert/student/support
*
```
{
    "username": "some_other_student", 
    "firstname": "Some", 
    "lastname": "Other Student",  
    "password":"NewPassword&*^420", 
    "country":"PK", 
    "parentID":5,
    "AuthToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Ik11aGFtbWFkIiwidXNlcnR5cGUiOiJBRE1JTiIsInVpZCI6MSwiaWF0IjoxNzM4MTQ4OTM1LCJleHAiOjE3MzgxODQ5MzV9.XOPVy7cUdnEQJknNpcHkx8rHhFODUxFMhgkFTz0zmjA"

}
```
> Parent ID is optional

## **<span style="color: orange;">POST</span>** Create Parent
Following is the JSON object that will be send to the server to make a new admin. This will me made to *https://api.convenientedu.com/user/insert/parent*
```
    {
    "username": "some_parent", "
    firstname": "Some", 
    "lastname": "Parent", 
    "password": "New_Password&*^420", 
    "country": "PK",
    "AuthToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Ik11aGFtbWFkIiwidXNlcnR5cGUiOiJBRE1JTiIsInVpZCI6MSwiaWF0IjoxNzM4MTQ4OTM1LCJleHAiOjE3MzgxODQ5MzV9.XOPVy7cUdnEQJknNpcHkx8rHhFODUxFMhgkFTz0zmjA"
}
```

## **<span style="color: orange;">POST</span>** Login
Following is the JSON object that will be send to the server to login. This will me made to *https://api.convenientedu.com/auth/login*
```
{
    "username": "Admin",
    "password": "Password"
}
```



# Requirements and Plans
Following are the plans for future versions and current known bugs.
## Version 1.1
### REQUIREMENTS FOR VERSION 1.1
- **Redis Server** Implementation.
- Page to create new general student
- Page to create new general classrooms
- Back End Verification For Working Time When Inserting New Class
- General Students can be added with a system allowing parents to select a classroom as well.
- Automatics Focus On Common Web pages
- Teacher Adding Tokens, front page. (No Edit Timing Page At This Stage)
- Teachers Can Cancel Class Within 6 Hours
- Automatic Link Allocation System
- Password Reset Page
- Add email to make sure users are unique
- In The Class Adder Selector, add a section for past teachers.
- Don't Show Inactive Classes
- Don't Show Inactive Users.
- Add phone (optional) to users
- Prometheus, Loki and Grafana Server Setups
### Bug Fixed Required
- Clear Buttons On
- Redirect to home after adding child, on page add children/add/students

## Version 1.2
### REQUIREMENTS FOR VERSION 1.2
- Support Students Can Change Time Within 4 Hours
- Parent Can Give Permission To Children For Adding New Classes
- Score For Each Class
	- Teacher Can Give Score For Each Student after each class
- Feedback For Each Class
	- Parents/Student Can Add Feedback for Manager Use
	- Teacher can add feedback for Parent and Manager Use 
- Adding Page For Managers And Teachers
- Seamless Sign Up For Parents
- Report Detail Page
- Report Page Re-design
- Back end User Permission Validation When Adding Class, Classroom and Child Entry.
- Way to make sure that every parent and student is unique.
- Feedback History

## Version 1.3
### REQUIREMENTS FOR VERSION 1.3
- Reports
	- Teacher Will Have To Add Weekly Reports for all general classes
	- Every Concerned Person can see reports
	- Report For Each Support Class
- Disable Student By Parent
- Report Teacher By Parent
- Report Details
- Not Robot Check
	
## Version 1.4
### REQUIREMENTS FOR VERSION 1.4
- Add User Info Page
	- Teacher Can Change Working Time (It should also send a notification to managers to update time)
	- Change Name Page

## Version 1.5
### REQUIREMENTS FOR VERSION 1.5
- Class Scoring Feature
	

## Version 2
### REQUIREMENTS FOR VERSION 2
- Add User Info Page
	- Teacher Can Change Working Time (It should also send a notification to managers to update time)
	- Change Name
- Add Chat Functionality
	- General Students/Parents can chat with all teachers that teach them
	- Support Students/Parents can only communicate with upcoming class teachers and with teachers within 3 past days
	- General Students can chat with their classmates
- Self Conference System