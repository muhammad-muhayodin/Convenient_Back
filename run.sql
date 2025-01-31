CREATE DATABASE IF NOT EXISTS convenientedu;

USE convenientedu;
SET @TRIGGER_DISABLED = FALSE ;


CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(40) UNIQUE,
    first_name VARCHAR(30) NOT NULL,
    last_name VARCHAR(30) NOT NULL,
    usertype ENUM('PARENT', 'STUDENT', 'TEACHER', 'MANAGER', 'ADMIN') NOT NULL,
    reset_permission BOOL DEFAULT FALSE,
    password_hash TEXT,
    active BOOL DEFAULT TRUE,
    country VARCHAR(20),
    INDEX indx_username (username),
    INDEX indx_id (id)
);


CREATE TABLE IF NOT EXISTS teacherRelation (
	id INT AUTO_INCREMENT PRIMARY KEY,
    uid INT,
    subject VARCHAR(20) NOT NULL,
    manager INT NOT NULL,
    FOREIGN KEY (uid) REFERENCES users(id),
    INDEX teacherIDX (uid)
);


DELIMITER $$

CREATE TRIGGER validTeacherRelation
BEFORE INSERT ON teacherRelation
FOR EACH ROW 
BEGIN 
    DECLARE usertype VARCHAR(20);
    DECLARE usertype_manager VARCHAR(20);
    -- Get the usertype for the teacher and the manager
    SELECT usertype INTO usertype FROM users WHERE id = NEW.uid LIMIT 1;
    SELECT usertype INTO usertype_manager FROM users WHERE id = NEW.manager LIMIT 1;
    
    -- Validate if the user is a TEACHER
    IF usertype <> "TEACHER" THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TEACHER NOT VALID';
    END IF;

    -- Validate if the manager is a MANAGER
    IF usertype_manager <> "MANAGER" THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'TEACHER MANAGER NOT VALID';
    END IF;

END$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS parentRelation (
	relationID INT AUTO_INCREMENT PRIMARY KEY,
	Parent_id INT NOT NULL,
	Student_id INT NOT NULL,
	INDEX idxParentRelation (Parent_id),
	INDEX idxStudentRelation (Student_id)
);

DELIMITER $$
CREATE TRIGGER validParentRelation
BEFORE INSERT ON parentRelation
FOR EACH ROW 
BEGIN 
	DECLARE parentType VARCHAR(20);
	DECLARE studentType VARCHAR(20);
	SELECT usertype INTO parentType FROM convenientedu.users WHERE id = new.Parent_id;
	SELECT usertype INTO studentType FROM convenientedu.users WHERE id = new.Student_id;
	
	IF parentType <> "PARENT" THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'PARENT NOT VALID';
		END IF;
	
	IF studentType <> "STUDENT" THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'STUDENT NOT VALID';
		END IF;
END$$
DELIMITER ;

CREATE TABLE IF NOT EXISTS teacherWorkingTime (
    id INT AUTO_INCREMENT PRIMARY KEY,  -- Unique identifier for each entry
    uid INT NOT NULL,                   -- User ID
    day TINYINT NOT NULL,               -- Day of the week (0-6)
    time TIME NOT NULL,                 -- Specific working time
    UNIQUE unique_entry (uid, day, time),  -- Ensure no duplicate time for the same UID on the same day
    INDEX idx_uid (uid),                -- Index for fast lookup by UID
    INDEX idx_day_id (day, uid),     -- Index for queries filtering by day and time
    FOREIGN KEY (uid) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS teacher_payments (
    uid INT NOT NULL,
    paymentValue FLOAT NOT NULL,
    lastPayment DATE NOT NULL DEFAULT '2000-01-01',
    FOREIGN KEY (uid) REFERENCES users(id)
);


CREATE TABLE IF NOT EXISTS number_of_payed_classes(
	id INT AUTO_INCREMENT PRIMARY KEY,
	parentID INT UNIQUE,
	classes INT DEFAULT 2,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parentID (parentID)
);

CREATE TABLE IF NOT EXISTS feePayedForGeneralClassesTill(
	id INT AUTO_INCREMENT PRIMARY KEY,
	parentID INT,
	studentID INT,
	payedTill DATE NOT NULL,
	paymentValue INT NOT NULL,
	UNIQUE (parentID, studentID),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parentID (parentID),
    INDEX idx_studentID (studentID)
);

DELIMITER $$
CREATE TRIGGER generalPayed
BEFORE INSERT ON feePayedForGeneralClassesTill
FOR EACH ROW
BEGIN 
    DECLARE usertypeThatShouldBeParent VARCHAR(100);
    DECLARE usertypeThatShouldBeStudent VARCHAR(100);

    -- Retrieve user types
    SELECT usertype INTO usertypeThatShouldBeParent 
    FROM convenientedu.users u 
    WHERE u.id = NEW.parentID;

    SELECT usertype INTO usertypeThatShouldBeStudent 
    FROM convenientedu.users u 
    WHERE u.id = NEW.studentID;

    -- Check if parent is 'PARENT'
    IF usertypeThatShouldBeParent <> 'PARENT' THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = "USER SHOULD BE PARENT";
    END IF;

    -- Check if student is 'STUDENT'
    IF usertypeThatShouldBeStudent <> 'STUDENT' THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = "USER SHOULD BE STUDENT";
    END IF;

END$$	

CREATE TRIGGER supportPayed
BEFORE INSERT ON number_of_payed_classes
FOR EACH ROW 
BEGIN 
    DECLARE usertypex VARCHAR(200);

    -- Retrieve the usertype of the parent
    SELECT usertype INTO usertypex 
    FROM users 
    WHERE id = NEW.parentID;

    -- Check if the usertype is not "PARENT"
    IF usertypex <> 'PARENT' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'User is not a parent';
    END IF;
END $$

DELIMITER ;



CREATE TABLE IF NOT EXISTS classrooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroomName VARCHAR(30) UNIQUE,
    max_students INT DEFAULT 1,
    managerID INT,
    classType ENUM('SUPPORT', 'GENERAL'),
    parentID INT
);




CREATE TABLE IF NOT EXISTS classroom_relation (
    classroomID INT NOT NULL,
    userID INT NOT NULL,
    FOREIGN KEY (userID) REFERENCES users(id),
    FOREIGN KEY (classroomID) REFERENCES classrooms(id),
    UNIQUE (classroomID, userID)
);

CREATE DATABASE IF NOT EXISTS convenientportal;

USE convenientportal;

CREATE TABLE IF NOT EXISTS timetable (
    classID INT AUTO_INCREMENT PRIMARY KEY,
    className VARCHAR(30),
    day INT,
    date DATE,
    time TIME,
    link TEXT,
    classroomID INT,
    teacherID INT,
    active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (classroomID) REFERENCES convenientedu.classrooms(id),
    FOREIGN KEY (teacherID) REFERENCES convenientedu.users(id),
    UNIQUE (teacherID, date, time),  -- Prevent overlapping classes
    UNIQUE (teacherID, day, time),
    UNIQUE (classroomID, day, time),
    UNIQUE (classroomID, date, time) -- Prevent overlapping classes
);


CREATE TABLE IF NOT EXISTS class_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classroomID INT NOT NULL,
    parentID INT,
    teacherID INT NOT NULL,
    timetableID INT NOT NULL,
    classDate DATE NOT NULL,
    classTime TIME NOT NULL,
    UNIQUE (classroomID, classDate, classTime),
    UNIQUE (id, classDate, classTime)
);



CREATE TABLE IF NOT EXISTS class_canceled (
    history_id INT NOT NULL,
    uid INT NOT NULL,        -- user (teacher/admin) who canceled the class
    TimetableID INT NOT NULL,
    classDate DATE NOT NULL,
    classTime TIME NOT NULL,
    cancellation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(history_id, uid),
    FOREIGN KEY (TimetableID) REFERENCES convenientportal.timetable(classID),
    FOREIGN KEY (uid) REFERENCES convenientedu.users(id),
    FOREIGN KEY (history_id) REFERENCES convenientportal.class_history(id)
);


CREATE TABLE IF NOT EXISTS class_joining (
    history_id INT NOT NULL,
    uid INT NOT NULL,
    TimetableID INT NOT NULL,
    classDate DATE NOT NULL,
    classTime TIME NOT NULL,
    ClassroomID INT NOT NULL,
    score INT,
    joinerType ENUM('PARENT', 'STUDENT', 'TEACHER', 'MANAGER', 'ADMIN') NOT NULL,
    joiningTime TIME NOT NULL,
    UNIQUE (history_id, uid),
    FOREIGN KEY (TimetableID) REFERENCES convenientportal.timetable(classID),
    FOREIGN KEY (uid) REFERENCES convenientedu.users(id),
    FOREIGN KEY (history_id) REFERENCES convenientportal.class_history(id),
    FOREIGN KEY (ClassroomID) REFERENCES convenientedu.classrooms(id)
);


DELIMITER $$
CREATE TRIGGER classJoinerIsRight
BEFORE INSERT ON class_joining
FOR EACH ROW 
BEGIN 
	DECLARE usertypeX VARCHAR(200);
	SELECT usertype INTO usertypeX FROM convenientedu.users u WHERE u.id = new.uid;
	
	IF usertypeX <> new.joinerType THEN
		SIGNAL SQLSTATE '45000';
		SET MESSAGE_TEXT = 'Invalid Joiner Type';
	END IF;
END
DELIMITER ;


USE convenientedu;
DELIMITER $$

-- Trigger to limit users in a classroom
CREATE TRIGGER classroom_relation_limit
BEFORE INSERT ON classroom_relation
FOR EACH ROW 
BEGIN 
    DECLARE num_users INT;
    DECLARE max_users INT;

    -- Count the number of users already in the classroom
    SELECT COUNT(*) 
    INTO num_users 
    FROM convenientedu.classroom_relation 
    WHERE classroomID = NEW.classroomID;

    -- Get the maximum allowed users for the classroom
    SELECT max_students 
    INTO max_users 
    FROM convenientedu.classrooms 
    WHERE id = NEW.classroomID;

    -- Check if the limit is exceeded
    IF num_users >= max_users THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'NO MORE ROOM IN CLASSROOM';
    END IF;
END$$

-- Trigger to ensure user type is STUDENT
CREATE TRIGGER classroom_relation_user
BEFORE INSERT ON classroom_relation
FOR EACH ROW
BEGIN 
    DECLARE usertype VARCHAR(30);

    -- Get the user type of the user being added
    SELECT usertype 
    INTO usertype 
    FROM convenientedu.users 
    WHERE id = NEW.userID;

    -- Ensure the user type is STUDENT
    IF usertype <> 'STUDENT' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'RELATION CAN BE BUILT WITH USERTYPE AS STUDENT';
    END IF;
END$$

DELIMITER ;

SELECT * FROM convenientportal.timetable t 
LEFT JOIN convenientportal.class_history ch ON t.classID = ch.timetableID
LEFT JOIN convenientportal.class_canceled cc ON ch.id = cc.history_id 
;


USE convenientedu;
SHOW tables;

USE convenientportal;
SHOW tables;

SELECT * FROM convenientportal.class_history;
SELECT * FROM convenientedu.users u ;
SELECT * FROM convenientportal.timetable t ;
SELECT * FROM convenientportal.class_canceled cc ;
SELECT * FROM convenientportal.class_history ch ;
SELECT * FROM convenientedu.teacher_payments p ;
SELECT * FROM convenientedu.teacherWorkingTime twt ;
SELECT * FROM convenientportal.class_joining cj ;
SELECT * FROM convenientedu.classrooms c ;
SELECT * FROM convenientedu.classroom_relation cr2 ;
SELECT * FROM convenientedu.parentRelation pr ;
SELECT * FROM convenientedu.teacherRelation tr ;
SELECT * FROM convenientedu.teacherWorkingTime twt ;
SELECT * FROM convenientedu.number_of_payed_classes nopc;
SELECT * FROM convenientedu.feePayedForGeneralClassesTill fpfgct ;

SELECT nopc.classes FROM convenientedu.number_of_payed_classes nopc WHERE nopc.parentID = 5;

INSERT INTO convenientedu.users (username, first_name, last_name, usertype, password_hash, country)
VALUES ("Muhammad", "Muhayodin", "Muhayodin", "ADMIN", "$argon2i$v=19$m=16,t=2,p=1$RXNhcUpNaWtGRVBKdUtkVg$3XtfgDVbRRMxA/DvdYNUtw", "PK");

SELECT DISTINCT cj.joiningTime, cc.cancellation_time, cc.classTime, cc.uid 'cancellerID',
ch.id 'historyID', ch.teacherID , c.managerID, c.classType, t.className, cr.userID 'STUDENTID',
c.classroomName, teacherUser.username 'teacherName', ch.classDate, tr.subject , studentUser.username 
FROM convenientportal.class_history ch
LEFT JOIN convenientportal.class_canceled cc ON ch.id = cc.history_id 
LEFT JOIN convenientportal.class_joining cj ON cj.history_id = ch.id 
INNER JOIN convenientedu.classrooms c ON c.id = ch.classroomID 
LEFT JOIN convenientedu.classroom_relation cr ON cr.classroomID = c.id 
INNER JOIN convenientportal.timetable t ON ch.timetableID = t.classID 
INNER JOIN convenientedu.users teacherUser ON teacherUser.id = t.teacherID 
INNER JOIN convenientedu.users studentUser ON studentUser.id = cr.userID 
INNER JOIN convenientedu.teacherRelation tr ON tr.id = teacherUser.id 
WHERE 
c.managerID = 0 -- FOR MANAGERS
OR 
(ch.parentID = 0) -- FOR PARENTS
OR 
cr.userID = 0 -- FOR STUDENTS
OR 
(ch.teacherID = 0 OR t.teacherID = 0) -- FOR TEACHERS
OR
('ADMIN' IN (SELECT usertype FROM convenientedu.users WHERE id = 1))
;     







SELECT link, classname AS subject, 
CURDATE() AS 'classDate', 
t.time AS 'classTime', 
c.classroomName AS 'classroomName', 
t.classID AS 'id', 
cc.cancellation_time AS 'cancelled',
ch.id AS 'historyID',
t.classID as 'TimetableID',
t.classroomID as 'classroomID'
FROM convenientportal.timetable t 
INNER JOIN convenientportal.class_history ch ON ch.timetableID = t.classID 
INNER JOIN convenientedu.classrooms c ON c.id = t.classroomID
LEFT JOIN convenientportal.class_canceled cc ON cc.history_id = ch.id
WHERE 
(t.day = 2 OR t.date = CURDATE() )
AND (
    c.managerID = 0 -- Manager
    OR
    c.parentID = 5 -- Parent
    OR
    (t.classroomID IN (SELECT classroomID FROM convenientedu.classroom_relation WHERE userID = 0)) -- Student
    OR 
    (t.classroomID IN (SELECT classroomID FROM convenientedu.classroom_relation cr INNER JOIN convenientedu.parentRelation pr ON cr.userID = pr.Student_id WHERE pr.Parent_id = 5)) -- Parent For General Classes
    OR 
    t.teacherID = 0
    OR 
    "ADMIN" IN (SELECT usertype FROM convenientedu.users u WHERE u.id = 1) -- ADMIN
)
;         

INSERT INTO convenientportal.class_history (classroomID, timetableID, classDate, classTime, teacherID, parentID) SELECT classroomID, classID, CURDATE(), time, teacherID, c.parentID FROM convenientportal.timetable t INNER JOIN convenientedu.classrooms c ON c.id = t.classroomID WHERE t.`day` = 2 OR t.`date` = CURDATE();
