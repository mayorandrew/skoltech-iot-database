FROM openjdk:8

#RUN apt-get update -y && \
#	apt-get install unzip

WORKDIR /opt
RUN wget https://s3.amazonaws.com/sitewhere/sitewhere-server-1.13.0.tgz && \
	tar -zxvf sitewhere-server-1.13.0.tgz && \
	mv sitewhere-server-1.13.0 /opt/sitewhere && \
	export SITEWHERE_HOME=/opt/sitewhere

WORKDIR /opt/sitewhere/bin
CMD ./startup.sh

